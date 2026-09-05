import { describe, expect, it } from "vitest";
import { notesToMigrate } from "./migrate";
import { DAILY, NOTE, NOTES_FOLDER, type Note } from "./types";

const note = (over: Partial<Note>): Note =>
  ({ id: "x", type: NOTE, title: "T", folder: "", body: "", tags: [], createdAt: "", updatedAt: "", ...over }) as Note;

describe("notesToMigrate", () => {
  it("moves a loose root Note into Notes", () => {
    const out = notesToMigrate([note({ id: "a", title: "Paul" })]);
    expect(out).toHaveLength(1);
    expect(out[0].folder).toBe(NOTES_FOLDER);
  });

  it("leaves Notes already in a topic folder alone", () => {
    expect(notesToMigrate([note({ id: "a", title: "Paul", folder: "People" })])).toEqual([]);
  });

  it("leaves Notes already in Notes alone", () => {
    expect(notesToMigrate([note({ id: "a", title: "Paul", folder: NOTES_FOLDER })])).toEqual([]);
  });

  it("ignores other types sitting at the root", () => {
    expect(notesToMigrate([note({ id: "a", type: DAILY, title: "2026-01-01" })])).toEqual([]);
  });

  it("keeps a root Note whose title is already taken in Notes", () => {
    const out = notesToMigrate([note({ id: "a", title: "Paul" }), note({ id: "b", title: "paul", folder: NOTES_FOLDER })]);
    expect(out).toEqual([]);
  });

  it("does not collide two root Notes with each other", () => {
    const out = notesToMigrate([note({ id: "a", title: "Paul" }), note({ id: "b", title: "PAUL" })]);
    expect(out.map((n) => n.id)).toEqual(["a"]);
  });
});
