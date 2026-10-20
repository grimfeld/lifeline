import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Document, DocumentTypeDef } from "@lifeline/core";

// Core's store is stood in for: these tests are about what the handlers do
// before they write, not about the store itself.
const types = new Map<string, DocumentTypeDef>();
const docs = new Map<string, Document>();
const core = vi.hoisted(() => ({
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
