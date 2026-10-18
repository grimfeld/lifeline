import { describe, expect, it } from "vitest";
import { freeTitle, streamOf, titleFromText } from "./stream";
import type { Thought } from "./types";

const t = (id: string, createdAt: string, updatedAt: string, kind = ""): Thought =>
  ({ id, type: "thought", title: id, body: id, tags: [], folder: "Thoughts", createdAt, updatedAt, deleted: 0, kind }) as Thought;

describe("titleFromText", () => {
  it("is the first non-empty line without heading marks", () => {
    expect(titleFromText("\n\n## What if   rooms had seasons\nmore")).toBe("What if rooms had seasons");
  });

  it("cuts a long line at a word and marks the cut", () => {
    const long = "A thought that runs on and on about the shape of the city at night when the trams stop and the streets go quiet";
    const title = titleFromText(long);
    expect(title.length).toBeLessThanOrEqual(81);
    expect(title.endsWith("…")).toBe(true);
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
  });

  it("reads a wikilink as the name it shows", () => {
    expect(titleFromText("Ask [[Ursula Le Guin]] about [[Paul|my brother]]")).toBe("Ask Ursula Le Guin about my brother");
  });

  it("is empty for empty text", () => {
    expect(titleFromText("   \n ")).toBe("");
  });
});

describe("freeTitle", () => {
  it("numbers a taken title, case-insensitively", () => {
    expect(freeTitle("Rain", [])).toBe("Rain");
    expect(freeTitle("Rain", ["rain", "Rain (2)"])).toBe("Rain (3)");
  });
});

describe("streamOf", () => {
  const all = [t("a", "2026-10-14", "1"), t("b", "2026-10-15", "2", "idea"), t("c", "2026-10-15", "3"), t("d", "2026-10-13", "4", "idea")];

  it("is newest day first, newest first inside a day", () => {
    expect(streamOf(all).map((d) => [d.date, d.thoughts.map((x) => x.id)])).toEqual([
      ["2026-10-15", ["c", "b"]],
      ["2026-10-14", ["a"]],
      ["2026-10-13", ["d"]],
    ]);
  });

  it("narrows to one kind, dropping days left empty", () => {
    expect(streamOf(all, "idea").map((d) => d.thoughts.map((x) => x.id))).toEqual([["b"], ["d"]]);
  });
});
