import { beforeEach, describe, expect, it, vi } from "vitest";
import { PLACE_TYPE } from "@lifeline/core";
import type { Document, DocumentTypeDef, OwnedCommand } from "@lifeline/core";
import { atlasApp } from "@lifeline/app-atlas";

// The Places tools (ADR 0119): core's store is stood in for, as in people.test.ts.
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
    todayStr: () => "2026-11-15",
  };
});

const { runTool } = await import("./handlers");
// Through the manifest only, as the server takes it (apps.ts).
const placeTypeDef = atlasApp.types.find((t) => t.id === PLACE_TYPE)!;

const place = (id: string, title: string, extra: Record<string, unknown> = {}) =>
  ({ id, type: PLACE_TYPE, title, folder: "Places", tags: [], body: "", createdAt: "2026-01-01", updatedAt: "2026-11-01", deleted: 0, aliases: [], kind: "", ...extra }) as unknown as Document;

beforeEach(() => {
  types.clear();
  docs.clear();
  commands.length = 0;
  core.createDocument.mockReset().mockImplementation(async (input: { type: string; title: string; fields: Record<string, unknown> }) => ({ ...place("new", input.title), ...input.fields }));
  types.set(PLACE_TYPE, placeTypeDef);
  commands.push(...atlasApp.commands.map((c) => ({ ...c, appId: "atlas" })));
  docs.set("p1", place("p1", "Chez Janou", { aliases: ["Janou"], kind: "restaurant", tags: ["provençal"], body: "The pastis bar upstairs." }));
});

describe("places_add", () => {
  it("adds a Place by its name alone, into Places", async () => {
    const out = await runTool("places_add", { name: "Lidl Prado" });
    expect(core.createDocument).toHaveBeenCalledWith(expect.objectContaining({ type: PLACE_TYPE, title: "Lidl Prado", folder: "Places", fields: { aliases: [], kind: "", tags: [] } }));
    expect(out).toEqual({ id: "new", message: "Added Lidl Prado to Places" });
  });

  it("keeps a Kind, by its name, with aliases and Tags", async () => {
    await runTool("places_add", { name: "Musée d'Orsay", kind: "Museum", aliases: ["the Orsay"], tags: ["art"] });
    expect(core.createDocument).toHaveBeenCalledWith(expect.objectContaining({ fields: { aliases: ["the Orsay"], kind: "museum", tags: ["art"] } }));
  });

  it("refuses a title a Place has, naming its id, and writes nothing", async () => {
    await expect(runTool("places_add", { name: "chez janou" })).rejects.toThrow("“chez janou” is already a Place: Chez Janou (id p1)");
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("refuses a Kind that is none, naming the Kinds", async () => {
    await expect(runTool("places_add", { name: "Spaceport", kind: "spaceport" })).rejects.toThrow(/No Kind “spaceport”: one of Restaurant, Café/);
  });
});

describe("Places are open to agents", () => {
  it("are found by search, by name, alias or type", async () => {
    for (const args of [{ query: "Janou" }, { type: PLACE_TYPE }, { query: "pastis" }]) {
      const out = (await runTool("search_documents", args)) as { documents: { id: string }[] };
      expect(out.documents.map((d) => d.id)).toEqual(["p1"]);
    }
  });

  it("are read whole by get_document: Kind, aliases, Tags and body", async () => {
    const out = (await runTool("get_document", { id: "p1" })) as { title: string; body: string; tags: string[]; fields: Record<string, unknown> };
    expect(out).toMatchObject({ title: "Chez Janou", body: "The pastis bar upstairs.", tags: ["provençal"], fields: { aliases: ["Janou"], kind: "restaurant" } });
  });
});
