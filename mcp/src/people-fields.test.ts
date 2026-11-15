import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { buildLinkIndex, linkFieldLabel, PERSON_TYPE, timelineOf } from "@lifeline/core";
import type { Document, DocumentTypeDef, OwnedCommand } from "@lifeline/core";
import { tasksApp } from "@lifeline/app-tasks";
import { ledgerApp } from "@lifeline/app-ledger";
import { libraryApp } from "@lifeline/app-library";
import { contactsApp } from "@lifeline/app-contacts";

// For on tasks_add and ledger_add, Recommended by on the Library's add tools (#453): the tool call over the real manifests, core's store stood in for as in people.test.ts.
const types = new Map<string, DocumentTypeDef>();
const docs = new Map<string, Document>();
const commands: OwnedCommand[] = [];
const core = vi.hoisted(() => ({ putDocument: vi.fn() }));

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
    todayStr: () => "2026-11-14",
  };
});

// Core reads a link argument's candidates from its own store module, so it is stood in for there too.
vi.mock("../../packages/core/src/documents/store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/core/src/documents/store")>()),
  getDocument: async (id: string) => docs.get(id),
  allDocuments: async () => [...docs.values()],
  documentsOf: async (type: string) => [...docs.values()].filter((d) => d.type === type),
}));

// …and so is the type registry it reads a link argument's noun ("Person") and a Document's aliases from.
vi.mock("../../packages/core/src/documents/registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../packages/core/src/documents/registry")>()),
  documentTypeSync: (id: string) => types.get(id),
}));

const { runTool } = await import("./handlers");

const person = (id: string, title: string, aliases: string[] = []) =>
  ({ id, type: PERSON_TYPE, title, folder: "People", tags: [], createdAt: "2026-01-01", updatedAt: "2026-11-01", deleted: 0, aliases, relationship: "" }) as unknown as Document;
const row = (id: string, type: string, title: string, extra: Record<string, unknown> = {}) =>
  ({ id, type, title, folder: "", tags: [], createdAt: "2026-01-01", updatedAt: "2026-11-01", deleted: 0, ...extra }) as unknown as Document;

/** The Document the call stored, as putDocument was handed it. */
const stored = () => core.putDocument.mock.calls.map((c) => c[0] as Record<string, unknown>);
const madeOf = (type: string) => stored().filter((d) => d.type === type);

beforeEach(() => {
  types.clear();
  docs.clear();
  commands.length = 0;
  let n = 0;
  core.putDocument.mockReset().mockImplementation(async (input: Record<string, unknown>) => ({ id: `n${++n}`, folder: "", createdAt: "", updatedAt: "", deleted: 0, ...input }));
  for (const app of [contactsApp, tasksApp, ledgerApp, libraryApp]) {
    for (const t of app.types) types.set(t.id, t);
    commands.push(...app.commands.map((c) => ({ ...c, appId: app.id })));
  }
  docs.set("p1", person("p1", "Marc Lefèvre", ["Marco"]));
  docs.set("p2", person("p2", "Zoé Martin"));
  docs.set("p3", person("p3", "Marc Dubois"));
  docs.set("p4", person("p4", "Marc"));
  docs.set("acc", row("acc", "ledger_account", "Current", { archived: false }));
  docs.set("cat", row("cat", "ledger_category", "Gifts", { kind: "expense" }));
});

const ADDS = [
  { tool: "tasks_add", arg: "for", field: "for", type: "task", base: { title: "Buy a present" }, msg: "Added task “Buy a present” (unassigned)", view: "For", lead: "for" },
  { tool: "ledger_add", arg: "for", field: "for", type: "ledger_transaction", base: { amount: 12.5, account: "acc", category: "Gifts" }, msg: "Added expense of", view: "For", lead: "for" },
  { tool: "library_add", arg: "recommendedBy", field: "recommendedBy", type: "book", base: { title: "Dune" }, msg: "Dune added", view: "Recommended by", lead: "recommended by" },
  { tool: "library_quick_add", arg: "recommendedBy", field: "recommendedBy", type: "book", base: { title: "Dune" }, msg: "Dune added", view: "Recommended by", lead: "recommended by" },
] as const;

describe.each(ADDS)("$tool with People", ({ tool, arg, field, type, base, msg, view, lead }) => {
  it("stores the Person an alias names, and says whom it found", async () => {
    const out = (await runTool(tool, { ...base, [arg]: ["Marco", "zoe martin"] })) as { message: string };
    expect(madeOf(type)).toHaveLength(1);
    expect(madeOf(type)[0]![field]).toEqual(["p1", "p2"]);
    expect(out.message).toContain(msg);
    expect(out.message).toMatch(new RegExp(` ${lead} Marc Lefèvre, Zoé Martin$`));
  });

  it("merges a Person named twice into one", async () => {
    docs.delete("p4");
    docs.delete("p3");
    await runTool(tool, { ...base, [arg]: ["Marco", "p1", "marc lefevre"] });
    expect(madeOf(type)[0]![field]).toEqual(["p1"]);
  });

  it("refuses an unknown and an ambiguous name together, making nothing", async () => {
    docs.set("p1", person("p1", "Marc Lefèvre", ["Marco", "Marc"]));
    const call = runTool(tool, { ...base, [arg]: ["Bob", "Marc"] });
    await expect(call).rejects.toThrow(`${view}: No Person called “Bob”; ${view}: “Marc” is more than one Person: Marc Lefèvre (id p1), Marc (id p4). Pass the id of the one meant`);
    expect(core.putDocument).not.toHaveBeenCalled();
  });

  it("puts the Document on the Person's Timeline via its field", async () => {
    await runTool(tool, { ...base, [arg]: ["Marco"] });
    const made = { ...madeOf(type)[0]!, id: "made", folder: "", createdAt: "", updatedAt: "", deleted: 0 } as unknown as Document;
    const [entry] = timelineOf(buildLinkIndex([made, ...docs.values()], [...types.values()]), "p1");
    expect(entry).toMatchObject({ sourceId: "made", field });
    expect(`via ${linkFieldLabel(made, types.get(type)!, entry!.field!)}`).toBe(`via ${view}`);
  });

  it("without the argument, makes it as before, with no one", async () => {
    const out = (await runTool(tool, { ...base })) as { message: string };
    expect(madeOf(type)[0]![field]).toEqual([]);
    expect(out.message).not.toContain(` ${lead} `);
    await runTool(tool, { ...base, [arg]: [] });
    expect(madeOf(type)[1]![field]).toEqual([]);
  });

  it("is listed as an array of strings taking ids, titles or aliases", async () => {
    const { TOOLS } = await import("./tools");
    const t = TOOLS.find((x) => x.name === tool)!;
    const listed = z.toJSONSchema(z.object(t.input)) as { properties: Record<string, { type?: string; items?: { type?: string }; description?: string }>; required?: string[] };
    expect(listed.properties[arg]).toMatchObject({ type: "array", items: { type: "string" } });
    expect(listed.properties[arg]!.description).toMatch(/ids, titles or aliases/);
    expect(listed.properties[arg]!.description).toMatch(/each must be only one Person/);
    expect(listed.required ?? []).not.toContain(arg);
  });
});
