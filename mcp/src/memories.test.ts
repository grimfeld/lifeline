import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document, DocumentTypeDef, OwnedCommand } from "@lifeline/core";
import { memoriesApp } from "@lifeline/app-memories";

// The Memories tool (ADR 0136): core's store is stood in for, as in places.test.ts.
const types = new Map<string, DocumentTypeDef>();
const docs = new Map<string, Document>();
const commands: OwnedCommand[] = [];
const core = vi.hoisted(() => ({ createDocument: vi.fn() }));

vi.mock("@lifeline/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lifeline/core")>();
  return {
    ...actual,
    ...core,
    allWorkspaces: async () => [],
    setCurrentWorkspace: () => undefined,
    documentTypeSync: (id: string) => types.get(id),
    allDocumentTypes: () => [...types.values()],
    getDocument: async (id: string) => docs.get(id),
    allDocuments: async () => [...docs.values()],
    documentsOf: async (type: string) => [...docs.values()].filter((d) => d.type === type),
    allMacros: async () => [],
    allCommands: () => commands,
    timedProviders: () => [],
    surfaceItemsIn: async () => ({ items: [], pool: [] }),
    todayStr: () => "2026-11-23",
  };
});

// Core reads a link argument's candidates, and names them, from its own store and registry modules: stood in for there too.
vi.mock("../../packages/core/src/documents/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/core/src/documents/store")>()),
  getDocument: async (id: string) => docs.get(id),
  allDocuments: async () => [...docs.values()],
  documentsOf: async (type: string) => [...docs.values()].filter((d) => d.type === type),
}));
vi.mock("../../packages/core/src/documents/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/core/src/documents/registry")>()),
  documentTypeSync: (id: string) => types.get(id),
}));

const { runTool } = await import("./handlers");
const MEMORY = "memories_memory";
const linkable = (id: string): DocumentTypeDef => ({ id, label: id, singular: id, titleRule: "name", body: "optional", linkable: true, fields: [], builtIn: true });
const doc = (id: string, type: string, title: string, extra: Record<string, unknown> = {}) =>
  ({ id, type, title, folder: "", tags: [], body: "", createdAt: "2026-01-01", updatedAt: "2026-11-01", deleted: 0, ...extra }) as unknown as Document;

beforeEach(() => {
  types.clear();
  docs.clear();
  commands.length = 0;
  core.createDocument.mockReset().mockImplementation(async (input: { type: string; title: string; folder: string; body: string; fields: Record<string, unknown> }) => ({ ...doc("new", input.type, input.title), folder: input.folder, body: input.body, ...input.fields }));
  // Through the manifest only, as the server takes it (apps.ts).
  types.set(MEMORY, memoriesApp.types.find((t) => t.id === MEMORY)!);
  for (const t of ["event", "contacts_person"]) types.set(t, linkable(t));
  commands.push(...memoriesApp.commands.map((c) => ({ ...c, appId: "memories" })));
  docs.set("e1", doc("e1", "event", "Ana's 30th"));
  docs.set("p1", doc("p1", "contacts_person", "Ana"));
});

describe("memories_add", () => {
  it("adds a Memory by its title alone, dated today, into Memories", async () => {
    const out = await runTool("memories_add", { title: "First snow" });
    expect(core.createDocument).toHaveBeenCalledWith({ type: MEMORY, title: "First snow", folder: "Memories", body: "", fields: { date: "2026-11-23", about: [] } });
    expect(out).toEqual({ id: "new", message: "Kept the memory “First snow”" });
  });

  it("keeps a date, its words, and what it is about, named or by id", async () => {
    const out = await runTool("memories_add", { title: "Dancing on the terrace", date: "2026-06-14", body: "Till two in the morning.", about: ["Ana's 30th", "p1"] });
    expect(core.createDocument).toHaveBeenCalledWith(expect.objectContaining({ body: "Till two in the morning.\n", fields: { date: "2026-06-14", about: ["e1", "p1"] } }));
    expect(out).toEqual({ id: "new", message: "Kept the memory “Dancing on the terrace” about Ana's 30th, Ana" });
  });

  it("refuses an About that names nothing, and writes nothing", async () => {
    await expect(runTool("memories_add", { title: "Then", about: ["Nobody"] })).rejects.toThrow(/About: No .*“Nobody”/);
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  // The agent wall (ADR 0114): a Private or internal Document is never named, by title or id, nor linked.
  it.each([
    ["by its title", "Diary of Ana"],
    ["by its id", "secret1"],
    ["an internal type's, by its title", "Hidden ledger"],
    ["an internal type's, by its id", "internal1"],
  ])("refuses an About naming a Document the agent may not see, %s, as unknown, and never names it", async (_, value) => {
    types.set("note", linkable("note"));
    types.set("hidden", { ...linkable("hidden"), internal: true });
    docs.set("secret1", doc("secret1", "note", "Diary of Ana", { folder: "Private/Diary" }));
    docs.set("internal1", doc("internal1", "hidden", "Hidden ledger"));
    const error = await runTool("memories_add", { title: "Then", about: [value] }).then(
      (out) => JSON.stringify(out),
      (e: Error) => e.message,
    );
    expect(error).toMatch(/About: No .* called/);
    for (const leak of ["Diary of Ana", "secret1", "Hidden ledger", "internal1"]) if (leak !== value) expect(error).not.toContain(leak);
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("never names a hidden Document among the candidates of an ambiguous About", async () => {
    types.set("note", linkable("note"));
    docs.set("secret1", doc("secret1", "note", "Ana", { folder: "Private" }));
    const out = await runTool("memories_add", { title: "Then", about: ["Ana"] });
    expect(core.createDocument).toHaveBeenCalledWith(expect.objectContaining({ fields: expect.objectContaining({ about: ["p1"] }) }));
    expect(JSON.stringify(out)).not.toContain("secret1");
  });

  it("takes no photo", () => {
    const add = memoriesApp.commands.find((c) => c.id === "memories.add")!;
    expect(add.args?.map((a) => a.key)).toEqual(["title", "date", "about", "body"]);
  });
});
