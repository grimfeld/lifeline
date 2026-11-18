import { describe, expect, it } from "vitest";
import type { Document, TimelineEntry } from "@lifeline/core";
import { agoOf, lastTimeOf } from "./lastTime";

const today = "2026-11-18";
const doc = (p: Record<string, unknown>) => ({ id: "d", type: "contacts_exchange", title: "", body: "", tags: [], updatedAt: "2026-11-01T10:00:00Z", ...p }) as unknown as Document;
const entryOf = (d: Document, via?: string): TimelineEntry => ({ sourceId: d.id, type: d.type, title: d.title, day: null, ownDay: true, ...(via ? { via } : {}) });
const pick = (docs: Document[], via?: string) => lastTimeOf(docs.map((d) => entryOf(d, via)), (id) => docs.find((d) => d.id === id), today);

describe("Last time: the newest thing they told me", () => {
  it("is none when nothing has text", () => {
    expect(pick([])).toBeNull();
    expect(pick([doc({ id: "a", date: "2026-11-10", body: "  \n " }), doc({ id: "b", type: "event", date: "2026-11-11", notes: "" })])).toBeNull();
  });

  it("is the newest day among Exchanges (their body) and Events (their Notes)", () => {
    const a = doc({ id: "a", kind: "call", date: "2026-11-10", body: "Hip surgery went well." });
    const b = doc({ id: "b", type: "event", title: "Lunch", date: "2026-11-12", notes: "Lucie starts in Lyon." });
    const c = doc({ id: "c", date: "2026-11-15", body: "" });
    expect(pick([a, b, c])).toMatchObject({ id: "b", label: "Event", day: "2026-11-12", text: "Lucie starts in Lyon." });
  });

  it("names an Exchange by its kind", () => {
    expect(pick([doc({ id: "a", kind: "video", date: "2026-11-10", body: "Hi" })])).toMatchObject({ label: "Video call", daysAgo: 8 });
  });

  it("breaks a tie of days by the last changed", () => {
    const a = doc({ id: "a", date: "2026-11-10", body: "old", updatedAt: "2026-11-11T08:00:00Z" });
    const b = doc({ id: "b", date: "2026-11-10", body: "new", updatedAt: "2026-11-12T08:00:00Z" });
    expect(pick([a, b])?.id).toBe("b");
  });

  it("counts what reaches them through a Household", () => {
    expect(pick([doc({ id: "a", date: "2026-11-10", body: "Moved house." })], "smiths")).toMatchObject({ id: "a" });
  });

  it("passes over a day to come, and anything that is neither an Exchange nor an Event", () => {
    const future = doc({ id: "f", type: "event", date: "2026-11-25", notes: "Next week" });
    const note = doc({ id: "n", type: "note", date: "2026-11-17", body: "A note naming them" });
    const past = doc({ id: "p", date: "2026-10-01", body: "Earlier" });
    expect(pick([future, note, past])?.id).toBe("p");
  });
});

describe("how long ago", () => {
  it("is plain words", () => {
    expect([0, 1, 5, 14, 40, 200, 400, 800].map(agoOf)).toEqual(["today", "yesterday", "5 days ago", "2 weeks ago", "1 month ago", "6 months ago", "1 year ago", "2 years ago"]);
  });
});
