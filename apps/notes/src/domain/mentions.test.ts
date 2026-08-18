import { describe, expect, it } from "vitest";
import { buildIndex } from "./index";
import { appendBullet, mentionsOf, rankMentions, unresolvedEntries } from "./mentions";
import type { Note } from "./types";

const note = (id: string, title: string, body: string, type: Note["type"] = "plain", updatedAt = ""): Note => ({
  id, title, body, type, folder: "", createdAt: "2026-01-01", updatedAt, deleted: 0,
});

const notes = [
  note("d1", "2026-08-16", "Coffee with [[Yasmine]] and [[Bob]]. Also [[Yasmine]] again. Met [[Nobody]].", "daily"),
  note("d2", "2026-08-10", "Dinner with [[Bob]]. Missing [[nobody]] and [[Ghost]].", "daily"),
  note("d3", "2026-07-01", "Old: [[Yasmine]] [[Bob]] [[Carl]]", "daily"),
  note("p1", "Yasmine", "A friend.", "person"),
  note("p2", "Bob", "Colleague.", "person"),
  note("p3", "Carl", "Ancient.", "person"),
  note("x1", "Project X", "Owned by [[Bob]].", "plain", "2026-08-12T10:00:00Z"),
];
const idx = buildIndex(notes);

describe("rankMentions", () => {
  it("counts distinct recent daily notes per person, newest-last, omits stale", () => {
    const r = rankMentions(idx, notes, { type: "person", since: "2026-08-01" });
    expect(r).toEqual([
      { noteId: "p2", count: 2, last: "2026-08-16" },
      { noteId: "p1", count: 1, last: "2026-08-16" },
    ]);
  });
  it("ignores non-daily sources and can span all types", () => {
    const r = rankMentions(idx, notes, { since: "2026-01-01" });
    expect(r.map((m) => m.noteId)).toEqual(["p2", "p1", "p3"]);
    expect(r[0].count).toBe(3); // x1 (plain) is not counted
  });
});

describe("mentionsOf", () => {
  it("lists newest first with context, mixing daily dates and edit dates", () => {
    const m = mentionsOf(idx, "p2");
    expect(m.map((x) => x.noteId)).toEqual(["d1", "x1", "d2", "d3"]);
    expect(m[0].context).toContain("[[Bob]]");
  });
});

describe("unresolvedEntries", () => {
  it("recovers display names and sorts by count then name", () => {
    expect(unresolvedEntries(idx)).toEqual([
      { name: "Nobody", noteIds: ["d1", "d2"] },
      { name: "Ghost", noteIds: ["d2"] },
    ]);
    expect(unresolvedEntries(idx, "name").map((e) => e.name)).toEqual(["Ghost", "Nobody"]);
  });
});

describe("appendBullet", () => {
  it("appends a bullet on its own line", () => {
    expect(appendBullet("", " hi ")).toBe("- hi\n");
    expect(appendBullet("a", "b")).toBe("a\n- b\n");
    expect(appendBullet("a\n", "b")).toBe("a\n- b\n");
  });
});
