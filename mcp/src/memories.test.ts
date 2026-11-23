import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document, DocumentTypeDef, MacroRecord, OwnedCommand } from "@lifeline/core";
import { memoriesApp } from "@lifeline/app-memories";

// The Memories tool (ADR 0136): core's store is stood in for, as in places.test.ts.
const types = new Map<string, DocumentTypeDef>();
const docs = new Map<string, Document>();
const commands: OwnedCommand[] = [];
const macros: MacroRecord[] = [];
const core = vi.hoisted(() => ({ createDocument: vi.fn(), saveMacro: vi.fn() }));

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
    allMacros: async () => macros,
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
  macros.length = 0;
  core.saveMacro.mockReset().mockImplementation(async (m: { name: string }) => ({ ...m, id: "mac1" }));
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

const failure = (p: Promise<unknown>) => p.then((out) => JSON.stringify(out), (e: Error) => e.message);

// The agent wall (ADR 0114) holds for a Macro an agent writes, lists or runs: its fixed links are looked up among the Documents the agent may see.
describe("an agent's Macro with a fixed About", () => {
  const hide = () => {
    types.set("note", linkable("note"));
    docs.set("secret1", doc("secret1", "note", "Diary of Ana", { folder: "Private/Diary" }));
    docs.set("secret2", doc("secret2", "note", "Diary of Ana", { folder: "Private" }));
    docs.set("secret3", doc("secret3", "note", "Letters", { folder: "Private" }));
  };
  const remember = (about: string) => ({ name: "Remember", steps: [{ command: "memories/memories.add", args: { title: { from: "fixed", value: "Then" }, about: { from: "fixed", value: [about] } } }] });
  const leaks = ["Diary of Ana", "secret1", "secret2", "Letters", "secret3"];

  it("is refused on create when the About matches two Private Documents, naming neither", async () => {
    hide();
    const error = await failure(runTool("create_macro", remember("Diary of Ana")));
    expect(error).toMatch(/About: No .* called “Diary of Ana”/);
    for (const leak of leaks.filter((l) => l !== "Diary of Ana")) expect(error).not.toContain(leak);
    expect(error).not.toMatch(/\(id /);
    expect(core.saveMacro).not.toHaveBeenCalled();
  });

  it("is refused, not saved, when the About matches one Private Document", async () => {
    hide();
    await expect(runTool("create_macro", remember("Letters"))).rejects.toThrow(/About: No .* called “Letters”/);
    expect(core.saveMacro).not.toHaveBeenCalled();
  });

  it("is refused on update the same way", async () => {
    hide();
    macros.push({ id: "mac1", sort: 0, updatedAt: "", deleted: 0, ...remember("Ana") } as unknown as MacroRecord);
    await expect(runTool("update_macro", { id: "mac1", ...remember("Letters") })).rejects.toThrow(/No .* called “Letters”/);
    expect(core.saveMacro).not.toHaveBeenCalled();
  });

  it("lists a saved one naming a Private Document as broken, without naming it", async () => {
    hide();
    macros.push({ id: "mac1", sort: 0, updatedAt: "", deleted: 0, ...remember("Diary of Ana") } as unknown as MacroRecord);
    const out = JSON.stringify(await runTool("list_macros", {}));
    expect(out).toMatch(/No .* called “Diary of Ana”/);
    for (const leak of leaks.filter((l) => l !== "Diary of Ana")) expect(out).not.toContain(leak);
  });

  it("runs a saved one naming a Private Document as broken, without naming it", async () => {
    hide();
    macros.push({ id: "mac1", sort: 0, updatedAt: "", deleted: 0, ...remember("Diary of Ana") } as unknown as MacroRecord);
    const error = await failure(runTool("macro_remember", {}));
    expect(error).toMatch(/No .* called “Diary of Ana”/);
    for (const leak of leaks.filter((l) => l !== "Diary of Ana")) expect(error).not.toContain(leak);
    expect(core.createDocument).not.toHaveBeenCalled();
  });
});

describe("create_document's link Fields", () => {
  it("refuses a link naming a Private Document, as unknown", async () => {
    types.set("note", linkable("note"));
    types.set("card", { id: "card", label: "Cards", singular: "Card", titleRule: "name", body: "optional", builtIn: false, fields: [{ key: "from", label: "From", kind: "link", linkType: "note" }] });
    docs.set("secret3", doc("secret3", "note", "Letters", { folder: "Private" }));
    const error = await failure(runTool("create_document", { type: "card", title: "Then", fields: { from: "Letters" } }));
    expect(error).toMatch(/From: No .* called “Letters”/);
    expect(error).not.toContain("secret3");
    expect(core.createDocument).not.toHaveBeenCalled();
  });
});
