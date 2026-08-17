import { describe, expect, it } from "vitest";
import { allFolders, buildTree, dailyFolder, isWithin, migrateFolder, normalizeFolder, notePath, parentFolder, rebase, titleTaken } from "./folders";
import type { Note } from "./types";

const note = (id: string, title: string, folder: string, type: Note["type"] = "plain"): Note => ({ id, title, folder, body: "", type, createdAt: "", updatedAt: "", deleted: 0 });

describe("folder paths", () => {
  it("normalises, parents, rebases", () => {
    expect(normalizeFolder(" /People / Friends/ ")).toBe("People/Friends");
    expect(parentFolder("People/Friends")).toBe("People");
    expect(parentFolder("People")).toBe("");
    expect(isWithin("People/Friends/Old", "People")).toBe(true);
    expect(isWithin("Peopled", "People")).toBe(false);
    expect(rebase("People/Friends/Old", "People", "Contacts")).toBe("Contacts/Friends/Old");
    expect(rebase("People", "People", "Contacts")).toBe("Contacts");
    expect(rebase("Other", "People", "Contacts")).toBe("Other");
    expect(notePath(note("a", "T", "A/B"))).toBe("A/B/T");
    expect(notePath(note("a", "T", ""))).toBe("T");
  });
  it("daily folder and legacy migration", () => {
    expect(dailyFolder("2026-08-17")).toBe("Journal/2026/08");
    expect(migrateFolder({ folder: undefined as unknown as string, type: "daily", title: "2026-08-17" })).toBe("Journal/2026/08");
    expect(migrateFolder({ folder: undefined as unknown as string, type: "template", title: "daily" })).toBe("Templates");
    expect(migrateFolder({ folder: undefined as unknown as string, type: "person", title: "X" })).toBe("");
    expect(migrateFolder({ folder: "A/", type: "person", title: "X" })).toBe("A");
  });
});

describe("tree", () => {
  it("builds nested folders, sorts folders by name and dailies newest first", () => {
    const root = buildTree(
      [note("1", "2026-08-16", "Journal/2026/08", "daily"), note("2", "2026-08-17", "Journal/2026/08", "daily"), note("3", "Zoe", "People"), note("4", "Adam", "People"), note("5", "Root note", "")],
      ["Empty/Sub"],
    );
    expect(root.folders.map((f) => f.name)).toEqual(["Empty", "Journal", "People"]);
    expect(allFolders(root)).toEqual(["Empty", "Empty/Sub", "Journal", "Journal/2026", "Journal/2026/08", "People"]);
    const aug = root.folders[1].folders[0].folders[0];
    expect(aug.notes.map((n) => n.title)).toEqual(["2026-08-17", "2026-08-16"]);
    expect(root.folders[2].notes.map((n) => n.title)).toEqual(["Adam", "Zoe"]);
    expect(root.notes.map((n) => n.title)).toEqual(["Root note"]);
  });
  it("titleTaken is per folder and case-insensitive", () => {
    const notes = [note("1", "Paul", "People"), note("2", "Paul", "Characters")];
    expect(titleTaken(notes, "People", "paul")).toBe(true);
    expect(titleTaken(notes, "People", "paul", "1")).toBe(false);
    expect(titleTaken(notes, "", "Paul")).toBe(false);
  });
});
