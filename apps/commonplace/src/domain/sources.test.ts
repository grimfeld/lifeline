import { describe, expect, it } from "vitest";
import { currentSources, familyOfDoc, familyLabel, type SourceItem } from "./works";
import { freeTitle, lastUsedBySource, noteTitleFrom } from "./notes";

const src = (id: string, extra: Partial<SourceItem> = {}): SourceItem =>
  ({ id, type: "source", title: id, tags: [], folder: "", createdAt: "2026-01-01", updatedAt: "", deleted: 0, creator: "", coverUrl: "", family: "article", ...extra }) as SourceItem;

describe("familyOfDoc", () => {
  it("is a work's type, an own Source's kind, else the wearer's type", () => {
    expect(familyOfDoc({ type: "book" })).toBe("book");
    expect(familyOfDoc({ type: "source", kind: "podcast" })).toBe("podcast");
    expect(familyOfDoc({ type: "source", kind: "" })).toBe("other");
    expect(familyOfDoc({ type: "person" })).toBe("person");
  });

  it("labels known families and falls back to the type's own name", () => {
    expect(familyLabel("music", true)).toBe("Albums");
    expect(familyLabel("episode")).toBe("Episode");
    expect(familyLabel("person", true, (t) => (t === "person" ? "People" : undefined))).toBe("People");
  });
});

describe("currentSources", () => {
  it("puts works in progress first, then the last taken from, then the newest added", () => {
    const items = [
      src("old", { createdAt: "2026-01-01" }),
      src("reading", { type: "book", family: "book", engagement: "IN_PROGRESS", startedOn: "2026-02-01" }),
      src("used", { createdAt: "2026-01-02" }),
      src("new", { createdAt: "2026-03-01" }),
      src("reading2", { type: "book", family: "book", engagement: "IN_PROGRESS", startedOn: "2026-03-01" }),
    ];
    const used = new Map([["used", "2026-04-01"]]);
    expect(currentSources(items, used).map((s) => s.id)).toEqual(["reading2", "reading", "used", "new", "old"]);
  });
});

describe("lastUsedBySource", () => {
  it("keeps each Source's latest day, from capture day or creation", () => {
    const m = lastUsedBySource([
      { source: "a", createdAt: "2026-01-01" },
      { source: "a", createdAt: "2026-01-05", capturedOn: "2026-01-03" },
      { source: "", createdAt: "2026-09-09" },
    ]);
    expect([...m]).toEqual([["a", "2026-01-03"]]);
  });
});

describe("noteTitleFrom", () => {
  it("is the first line, wikilinks read as names, a blockquote mark dropped", () => {
    expect(noteTitleFrom("> [[Ged]] learns his [[true name|name]]\nmore")).toBe("Ged learns his name");
  });
  it("numbers a repeat", () => {
    expect(freeTitle("Naming", ["naming"])).toBe("Naming (2)");
  });
});
