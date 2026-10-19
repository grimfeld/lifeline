import { describe, expect, it } from "vitest";
import { quoteMarkdown, quoteName, quoteOfTheDay, searchQuotes } from "./quotes";
import type { Quote } from "./types";
import type { SourceItem } from "./works";

const q = (id: string, text: string, extra: Partial<Quote> = {}): Quote => ({ id, type: "quote", title: "", tags: [], folder: "", createdAt: "2026-08-19", source: "m1", body: text, locator: "", comment: "", capturedOn: "2026-08-19", kept: false, topic: "", keptAt: "", updatedAt: "", deleted: 0, ...extra });
const item = { id: "m1", title: "Dune", creator: "Frank Herbert" } as SourceItem;

describe("quotes", () => {
  it("names a quote by its opening words", () => {
    expect(quoteName("Fear is the mind-killer.")).toBe("Fear is the mind-killer.");
    expect(quoteName("I must not fear. Fear is the mind-killer. Fear is the little-death that brings total obliteration.", 40)).toBe("I must not fear. Fear is the…");
  });
  it("renders the blockquote with attribution", () => {
    expect(quoteMarkdown(q("a", "Fear is the mind-killer.", { locator: "p. 12" }), item)).toBe("> Fear is the mind-killer.\n> — [[Dune]], Frank Herbert, p. 12\n");
    expect(quoteMarkdown(q("a", "Line one\nLine two"), undefined)).toBe("> Line one\n> Line two\n> —\n".replace("> —\n", "> —\n"));
  });
  it("quote of the day is stable per day and varies across days", () => {
    const pool = [q("a", "x"), q("b", "y"), q("c", "z")];
    expect(quoteOfTheDay(pool, "2026-08-19")).toBe(quoteOfTheDay(pool, "2026-08-19"));
    const picks = new Set(["2026-08-19", "2026-08-20", "2026-08-21", "2026-08-22"].map((d) => quoteOfTheDay(pool, d)!.id));
    expect(picks.size).toBeGreaterThan(1);
    expect(quoteOfTheDay([], "2026-08-19")).toBeUndefined();
  });
  it("searches text, comment, item and tags", () => {
    const items = new Map([["m1", item]]);
    const quotes = [q("a", "Fear is the mind-killer.", { tags: ["courage"] }), q("b", "Other", { comment: "about sand" })];
    expect(searchQuotes(quotes, items, "mind").map((x) => x.id)).toEqual(["a"]);
    expect(searchQuotes(quotes, items, "dune").map((x) => x.id)).toEqual(["a", "b"]);
    expect(searchQuotes(quotes, items, "#courage").map((x) => x.id)).toEqual(["a"]);
    expect(searchQuotes(quotes, items, "sand").map((x) => x.id)).toEqual(["b"]);
  });
});
