import { describe, expect, it } from "vitest";
import { pickRandom, searchNotes, tagSnippet } from "./search";
import type { Document } from "@lifeline/core";

const note = (id: string, title: string, body: string, updatedAt = "2026-01-01"): Document => ({ id, title, body, type: "note", folder: "", tags: [], createdAt: "2026-01-01", updatedAt, deleted: 0 });

describe("tagSnippet", () => {
  it("centers on the first #tag occurrence", () => {
    const body = "x".repeat(200) + " here is #idea worth keeping " + "y".repeat(200);
    const s = tagSnippet(body, "idea", 20);
    expect(s).toContain("#idea");
    expect(s.startsWith("…")).toBe(true);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThan(60);
  });
  it("does not match a longer tag or a heading", () => {
    expect(tagSnippet("# idea\nsome #ideas text", "idea")).not.toContain("#ideas…");
    expect(tagSnippet("just prose", "idea")).toBe("just prose");
  });
});

describe("searchNotes", () => {
  const notes = [note("a", "Alpha", "nothing here", "2026-01-02"), note("b", "Beta", "the alpha particle", "2026-01-03"), note("c", "Gamma", "zzz")];
  it("ranks title, then alias, then body", () => {
    expect(searchNotes(notes, "ALPHA", (n) => (n.id === "c" ? ["alphabet"] : [])).map((h) => h.note.id)).toEqual(["a", "c", "b"]);
  });
  it("snippets around a body match and returns nothing for an empty query", () => {
    expect(searchNotes(notes, "particle")[0]?.snippet).toContain("alpha particle");
    expect(searchNotes(notes, "  ")).toEqual([]);
  });
});

describe("pickRandom", () => {
  it("never repeats when the pool has more than one", () => {
    const pool = [{ id: "1" }, { id: "2" }];
    for (let i = 0; i < 20; i++) expect(pickRandom(pool, "1")?.id).toBe("2");
    expect(pickRandom([{ id: "1" }], "1")?.id).toBe("1");
    expect(pickRandom([], "1")).toBeUndefined();
  });
});
