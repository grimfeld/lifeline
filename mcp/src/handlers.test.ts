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
  };
});

const { runTool, ToolError } = await import("./handlers");

const journal: DocumentTypeDef = {
  id: "journal_entry",
  label: "Journal entries",
  titleRule: "unique",
  body: "required",
  fields: [{ key: "mood", label: "Mood", kind: "number" }],
} as DocumentTypeDef;

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
