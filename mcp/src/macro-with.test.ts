import { beforeEach, describe, expect, it, vi } from "vitest";
import { PERSON_TYPE } from "@lifeline/core";
import type { Document, DocumentTypeDef, MacroRecord, MacroStep, OwnedCommand, StepArg } from "@lifeline/core";
import { calendarApp, EVENT_TYPE } from "@lifeline/app-calendar";
import { contactsApp } from "@lifeline/app-contacts";

// A Macro step's With (#454): create_macro, update_macro and a Macro's tool over the real manifests, core's store stood in for as in calendar-with.test.ts.
const types = new Map<string, DocumentTypeDef>();
const docs = new Map<string, Document>();
const commands: OwnedCommand[] = [];
const macros: MacroRecord[] = [];
const core = vi.hoisted(() => ({ putDocument: vi.fn(), saveMacro: vi.fn(), createDocument: vi.fn() }));

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
const personTypeDef = contactsApp.types.find((t) => t.id === PERSON_TYPE)!;
const eventTypeDef = calendarApp.types.find((t) => t.id === EVENT_TYPE)!;

const person = (id: string, title: string, aliases: string[] = []) =>
  ({ id, type: PERSON_TYPE, title, folder: "People", tags: [], createdAt: "2026-01-01", updatedAt: "2026-11-01", deleted: 0, aliases, relationship: "" }) as unknown as Document;

beforeEach(() => {
  types.clear();
  docs.clear();
  commands.length = 0;
  macros.length = 0;
  core.saveMacro.mockReset().mockImplementation(async (m: MacroRecord) => ({ ...m, id: m.id ?? "new" }));
  core.putDocument.mockReset().mockImplementation(async (input: Record<string, unknown>) => ({ id: "e1", folder: "", createdAt: "", updatedAt: "", deleted: 0, ...input }));
  types.set(PERSON_TYPE, personTypeDef);
  types.set(EVENT_TYPE, eventTypeDef);
  commands.push(...calendarApp.commands.map((c) => ({ ...c, appId: "calendar" })), ...contactsApp.commands.map((c) => ({ ...c, appId: "contacts" })));
  // A Person added by a step is in the store for the next step to name.
  core.createDocument.mockReset().mockImplementation(async (input: { title: string; fields: Record<string, unknown> }) => {
    const made = { ...person("new-person", input.title), ...input.fields } as Document;
    docs.set(made.id, made);
    return made;
  });
  docs.set("p1", person("p1", "Marc Lefèvre", ["Marco"]));
  docs.set("p2", person("p2", "Zoé Martin"));
  docs.set("p3", person("p3", "Marc Dubois"));
  docs.set("p4", person("p4", "Marc"));
});

const ADD_EVENT = "calendar/calendar.add-event";
const dinner = (withArg?: StepArg): MacroStep[] => [
  { command: ADD_EVENT, args: { title: { from: "fixed", value: "Dinner" }, date: { from: "fixed", value: "2026-11-14" }, ...(withArg ? { with: withArg } : {}) } },
];
const rec = (id: string, name: string, steps: MacroRecord["steps"]): MacroRecord => ({ id, name, steps, sort: macros.length, updatedAt: "", deleted: 0 });

describe("a Macro step's With", () => {
  it("is saved fixed to People named by alias or id", async () => {
    const steps = dinner({ from: "fixed", value: ["Marco", "p2"] });
    await runTool("create_macro", { name: "Dinner", steps });
    expect(core.saveMacro).toHaveBeenCalledWith({ name: "Dinner", steps });
  });

  it("is refused at create_macro and update_macro when a fixed entry names no one or several, saying which", async () => {
    const steps = dinner({ from: "fixed", value: ["Bob", "Marc", "Zoé"] });
    docs.set("p1", person("p1", "Marc Lefèvre", ["Marco", "Marc"]));
    const said = "Step 1: With: No Person called “Bob”; Step 1: With: “Marc” is more than one Person: Marc Lefèvre (id p1), Marc (id p4). Pass the id of the one meant";
    await expect(runTool("create_macro", { name: "Dinner", steps })).rejects.toThrow(said);
    macros.push(rec("m1", "Dinner", dinner({ from: "asked" })));
    await expect(runTool("update_macro", { id: "m1", steps })).rejects.toThrow(said);
    expect(core.saveMacro).not.toHaveBeenCalled();
  });

  it("asked when it runs, the Macro's tool takes names, aliases or ids", async () => {
    macros.push(rec("m1", "Dinner", dinner({ from: "asked" })));
    await runTool("macro_dinner", { s1_with: ["Marco", "zoe martin", "p1"] });
    expect(core.putDocument.mock.calls[0]![0]).toMatchObject({ title: "Dinner", with: ["p1", "p2"] });
  });

  it("takes what an earlier Add person step made, as its one entry", async () => {
    macros.push(rec("m1", "Met someone", [{ command: "contacts/people.add", args: { name: { from: "asked" } } }, ...dinner({ from: "step", step: 0 })]));
    await runTool("macro_met_someone", { s1_name: "Léa Roux" });
    expect(core.putDocument.mock.calls[0]![0]).toMatchObject({ title: "Dinner", with: ["new-person"] });
  });

  it("shows broken, with the candidates, once a fixed name has become ambiguous, and runs nothing", async () => {
    macros.push(rec("m1", "Dinner", dinner({ from: "fixed", value: ["Marc Lefevre"] })));
    docs.set("p5", person("p5", "Marc Lefèvre"));
    const out = (await runTool("list_macros", {})) as { macros: { broken?: string[] }[] };
    expect(out.macros[0]!.broken).toEqual(["Step 1: With: “Marc Lefevre” is more than one Person: Marc Lefèvre (id p1), Marc Lefèvre (id p5). Pass the id of the one meant"]);
    await expect(runTool("macro_dinner", {})).rejects.toThrow(/more than one Person/);
    expect(core.putDocument).not.toHaveBeenCalled();
  });
});
