import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document, DocumentTypeDef, MacroRecord, OwnedCommand } from "@lifeline/core";

// Core's store is stood in for: these tests are about what the handlers do
// before they write, not about the store itself.
const types = new Map<string, DocumentTypeDef>();
const docs = new Map<string, Document>();
const macros: MacroRecord[] = [];
const commands: OwnedCommand[] = [];
const core = vi.hoisted(() => ({
  saveMacro: vi.fn(),
  createDocument: vi.fn(),
  moveDocument: vi.fn(),
  renameDocument: vi.fn(),
  patchDocument: vi.fn(),
  reschedule: vi.fn(),
}));

vi.mock("@lifeline/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@lifeline/core")>();
  return {
    ...actual,
    ...core,
    allWorkspaces: async () => [],
    setCurrentWorkspace: () => undefined,
    documentTypeSync: (id: string) => types.get(id),
    getDocument: async (id: string) => docs.get(id),
    allDocuments: async () => [...docs.values()],
    allMacros: async () => macros,
    allCommands: () => commands,
    timedProviders: () => [{ appId: "calendar", useItems: () => [], reschedule: core.reschedule }],
  };
});

const { runTool, ToolError } = await import("./handlers");

const journal: DocumentTypeDef = {
  id: "journal_entry",
  label: "Journal entries",
  builtIn: false,
  titleRule: "name",
  body: "required",
  fields: [{ key: "mood", label: "Mood", kind: "number" }],
};

beforeEach(() => {
  types.clear();
  docs.clear();
  for (const fn of Object.values(core)) fn.mockReset().mockResolvedValue(undefined);
  core.createDocument.mockImplementation(async (input: { type: string; title: string; folder: string }) => ({ id: "new", ...input }));
});

describe("create_document", () => {
  it("refuses a type whose default folder is Private without writing anything", async () => {
    types.set("diary", { ...journal, id: "diary", label: "Diary entries", folder: "Private/Diary" });
    await expect(runTool("create_document", { type: "diary", title: "Today" })).rejects.toBeInstanceOf(ToolError);
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("refuses an explicit Private folder without writing anything", async () => {
    types.set(journal.id, journal);
    await expect(runTool("create_document", { type: journal.id, title: "x", folder: "Private/sub" })).rejects.toThrow(/Private/);
    expect(core.createDocument).not.toHaveBeenCalled();
  });

  it("creates in the type's default folder otherwise", async () => {
    types.set(journal.id, { ...journal, folder: "Journal" });
    await runTool("create_document", { type: journal.id, title: "Today" });
    expect(core.createDocument).toHaveBeenCalledWith(expect.objectContaining({ folder: "Journal", title: "Today" }));
  });
});

describe("update_document", () => {
  beforeEach(() => {
    types.set(journal.id, journal);
    docs.set("d1", { id: "d1", type: journal.id, title: "Old", folder: "A", tags: [], createdAt: "", updatedAt: "" } as unknown as Document);
  });

  it("writes nothing when a field is invalid, even alongside a move and a rename", async () => {
    await expect(runTool("update_document", { id: "d1", folder: "B", title: "New", fields: { nope: 1 } })).rejects.toBeInstanceOf(ToolError);
    expect(core.moveDocument).not.toHaveBeenCalled();
    expect(core.renameDocument).not.toHaveBeenCalled();
    expect(core.patchDocument).not.toHaveBeenCalled();
  });

  it("writes nothing when the body is refused", async () => {
    types.set(journal.id, { ...journal, body: "none" });
    await expect(runTool("update_document", { id: "d1", folder: "B", body: "text" })).rejects.toThrow(/no body/);
    expect(core.moveDocument).not.toHaveBeenCalled();
  });

  it("writes nothing when a derived title is renamed", async () => {
    types.set(journal.id, { ...journal, titleRule: "derived" });
    await expect(runTool("update_document", { id: "d1", folder: "B", title: "New" })).rejects.toThrow(/title/);
    expect(core.moveDocument).not.toHaveBeenCalled();
  });

  it("writes nothing when the new title clashes in the target folder", async () => {
    docs.set("d2", { id: "d2", type: journal.id, title: "New", folder: "B", tags: [], createdAt: "", updatedAt: "" } as unknown as Document);
    await expect(runTool("update_document", { id: "d1", folder: "B", title: "New" })).rejects.toThrow(/already exists/);
    expect(core.moveDocument).not.toHaveBeenCalled();
  });

  it("applies move, rename and fields once all are valid", async () => {
    const result = (await runTool("update_document", { id: "d1", folder: "B", title: "New", fields: { mood: 3 } })) as { message: string };
    expect(core.moveDocument).toHaveBeenCalled();
    expect(core.renameDocument).toHaveBeenCalled();
    expect(core.patchDocument).toHaveBeenCalledWith("d1", { mood: 3 });
    expect(result.message).toBe("Updated folder, title, mood");
  });
});

describe("reschedule_timed", () => {
  it("passes an end day through, so an Event can be moved to run overnight", async () => {
    await runTool("reschedule_timed", { appId: "calendar", itemId: "e1", date: "2026-08-10", start: "22:00", endDate: "2026-08-11", end: "06:00" });
    expect(core.reschedule).toHaveBeenCalledWith("e1", { date: "2026-08-10", start: "22:00", endDate: "2026-08-11", end: "06:00" });
  });

  it("ends on the start day when no end day is given", async () => {
    await runTool("reschedule_timed", { appId: "calendar", itemId: "e1", date: "2026-08-10", start: "09:00", end: "10:00" });
    expect(core.reschedule).toHaveBeenCalledWith("e1", { date: "2026-08-10", start: "09:00", endDate: "2026-08-10", end: "10:00" });
  });

  it("refuses an end that isn't after the start, by the shared rule, without writing", async () => {
    await expect(runTool("reschedule_timed", { appId: "calendar", itemId: "e1", date: "2026-08-10", start: "09:00", end: "09:00" })).rejects.toBeInstanceOf(ToolError);
    await expect(runTool("reschedule_timed", { appId: "calendar", itemId: "e1", date: "2026-08-10", start: "22:00", end: "06:00" })).rejects.toThrow(/after/);
    await expect(runTool("reschedule_timed", { appId: "calendar", itemId: "e1", date: "2026-08-11", start: "09:00", endDate: "2026-08-10", end: "17:00" })).rejects.toThrow(/after/);
    expect(core.reschedule).not.toHaveBeenCalled();
  });
});

describe("Macros", () => {
  const added: string[] = [];
  const add: OwnedCommand = {
    appId: "tasks",
    id: "add",
    title: "Add task",
    args: [{ key: "title", label: "Title", kind: "text", required: true }],
    invoke: async ({ title }) => {
      if (title === "dup") throw new Error("Already on the list");
      added.push(String(title));
      return { message: `Added “${title}”`, id: `t-${title}` };
    },
  };
  const rec = (id: string, name: string, steps: MacroRecord["steps"]): MacroRecord => ({ id, name, steps, sort: macros.length, updatedAt: "", deleted: 0 });

  beforeEach(() => {
    added.length = 0;
    macros.length = 0;
    commands.length = 0;
    commands.push(add);
    core.saveMacro.mockImplementation(async (m: MacroRecord) => ({ ...m, id: m.id ?? "new" }));
  });

  it("runs a headless Macro's tool with its asked arguments, returning each step's report", async () => {
    macros.push(rec("m1", "Two tasks", [
      { command: "tasks/add", args: { title: { from: "asked" } } },
      { command: "tasks/add", args: { title: { from: "fixed", value: "dup" } }, skipIfRefused: true },
      { command: "tasks/add", args: { title: { from: "fixed", value: "last" } } },
    ]));
    const result = (await runTool("macro_two_tasks", { s1_title: "call mum" })) as { message: string; report: { steps: unknown[] } };
    expect(added).toEqual(["call mum", "last"]);
    expect(result.report.steps).toEqual([
      { title: "Add task", status: "done", message: "Added “call mum”", id: "t-call mum" },
      { title: "Add task", status: "skipped", reason: "Already on the list" },
      { title: "Add task", status: "done", message: "Added “last”", id: "t-last" },
    ]);
    expect(result.message).toContain("skipped, Already on the list");
  });

  it("reports where a refused step stopped the Macro", async () => {
    macros.push(rec("m1", "Stops", [
      { command: "tasks/add", args: { title: { from: "fixed", value: "dup" } } },
      { command: "tasks/add", args: { title: { from: "fixed", value: "never" } } },
    ]));
    const result = (await runTool("macro_stops", {})) as { report: { steps: { status: string }[] } };
    expect(result.report.steps.map((s) => s.status)).toEqual(["stopped", "not-reached"]);
    expect(added).toEqual([]);
  });

  it("refuses to run a broken Macro, running nothing", async () => {
    macros.push(rec("m1", "Broken", [
      { command: "tasks/add", args: { title: { from: "fixed", value: "first" } } },
      { command: "tasks/add", args: { nope: { from: "fixed", value: 1 }, title: { from: "fixed", value: "x" } } },
    ]));
    await expect(runTool("macro_broken", {})).rejects.toThrow(/takes no “nope”/);
    expect(added).toEqual([]);
  });

  it("lists Macros with their steps, state and tool", async () => {
    macros.push(rec("m1", "Fine", [{ command: "tasks/add", args: { title: { from: "asked" } } }]), rec("m2", "Gone", [{ command: "old/thing", args: {} }]));
    const list = (await runTool("list_macros", {})) as { macros: { id: string; tool?: string; broken?: string[]; steps: unknown[] }[]; commands?: unknown };
    expect(list.macros[0]).toMatchObject({ id: "m1", name: "Fine", tool: "macro_fine", steps: macros[0].steps });
    expect(list.macros[0].broken).toBeUndefined();
    expect(list.macros[1].broken).toEqual([expect.stringMatching(/no longer exists/)]);
    expect(list.macros[1].tool).toBeUndefined();
    expect(list.commands).toBeUndefined();
    const withCommands = (await runTool("list_macros", { commands: true })) as { commands: unknown[] };
    expect(withCommands.commands).toEqual([expect.objectContaining({ command: "tasks/add", title: "Add task", headless: true })]);
  });

  it("creates a Macro that passes the check, and refuses a broken one without saving", async () => {
    await expect(runTool("create_macro", { name: "Bad", steps: [{ command: "tasks/add", args: {} }] })).rejects.toThrow(/Title is required/);
    await expect(runTool("create_macro", { name: "Nested", steps: [{ command: "macros/m1", args: {} }] })).rejects.toBeInstanceOf(ToolError);
    expect(core.saveMacro).not.toHaveBeenCalled();
    const steps = [{ command: "tasks/add", args: { title: { from: "asked" } } }];
    const made = (await runTool("create_macro", { name: " Plan ", steps })) as { id: string; message: string };
    expect(core.saveMacro).toHaveBeenCalledWith({ name: "Plan", steps });
    expect(made.id).toBe("new");
  });

  it("refuses a Macro as a step, by the check's own reason", async () => {
    macros.push(rec("m1", "Fine", [{ command: "tasks/add", args: { title: { from: "asked" } } }]));
    await expect(runTool("create_macro", { name: "Nested", steps: [{ command: "macros/m1", args: {} }] })).rejects.toThrow(/cannot be a step/);
  });

  it("updates a Macro's name or steps, keeping the rest, and refuses a broken result", async () => {
    macros.push({ ...rec("m1", "Old", [{ command: "tasks/add", args: { title: { from: "asked" } } }]), builtin: "morning" });
    await expect(runTool("update_macro", { id: "m1", steps: [{ command: "tasks/add", args: {} }] })).rejects.toBeInstanceOf(ToolError);
    await expect(runTool("update_macro", { id: "nope", name: "X" })).rejects.toThrow(/No Macro/);
    expect(core.saveMacro).not.toHaveBeenCalled();
    await runTool("update_macro", { id: "m1", name: "New" });
    expect(core.saveMacro).toHaveBeenCalledWith(expect.objectContaining({ id: "m1", name: "New", builtin: "morning", steps: macros[0].steps, sort: 0 }));
  });
});
