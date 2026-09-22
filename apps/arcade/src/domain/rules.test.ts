import { describe, expect, it } from "vitest";
import { onShelf, shelfLabel } from "./browse";
import { parseQuickTitle } from "../data/repo";
import type { Work } from "./types";
import { abandon, finish, shelfOfShame, wantedList, start } from "./rules";

function item(p: Partial<Work>): Work {
  return {
    id: p.id ?? "x", updatedAt: "", deleted: 0, type: "game", title: "t", tags: [], folder: "", createdAt: "2026-01-01",
    creator: "", externalKey: "", coverUrl: "", size: 0, year: 0, acquisition: "WANTED", engagement: "UNSTARTED",
    reason: "", addedOn: "2026-01-01", acquiredOn: "", startedOn: "", finishedOn: "", ...p,
  } as Work;
}

describe("transitions", () => {
  it("start/finish stamp their days; abandon does not", () => {
    expect(start("2026-08-16")).toEqual({ engagement: "IN_PROGRESS", startedOn: "2026-08-16" });
    expect(finish("2026-08-16")).toEqual({ engagement: "DONE", finishedOn: "2026-08-16" });
    expect(abandon()).toEqual({ engagement: "ABANDONED" });
  });
});

describe("derived views", () => {
  it("owned + unstarted is the shelf of shame, oldest first", () => {
    const s = shelfOfShame([
      item({ id: "n", acquisition: "OWNED", acquiredOn: "2026-03-01" }),
      item({ id: "o", acquisition: "OWNED", acquiredOn: "2025-01-01" }),
      item({ id: "r", acquisition: "OWNED", engagement: "DONE" }),
    ]);
    expect(s.map((m) => m.id)).toEqual(["o", "n"]);
  });
  it("wantedList lists every Wanted item, oldest wish first", () => {
    const list = wantedList([
      item({ id: "young", acquisition: "WANTED", addedOn: "2026-06-01" }),
      item({ id: "owned", acquisition: "OWNED" }),
      item({ id: "old", acquisition: "WANTED", addedOn: "2025-01-01" }),
    ]);
    expect(list.map((m) => m.id)).toEqual(["old", "young"]);
  });
});

describe("shelf", () => {
  it("labels use the Arcade's verbs", () => {
    expect(shelfLabel("UNSTARTED", "game")).toBe("To play");
    expect(shelfLabel("ABANDONED", "game")).toBe("Dropped");
    expect(onShelf(item({ engagement: "DONE" }), "DONE")).toBe(true);
    expect(onShelf(item({ engagement: "DONE" }), "ALL")).toBe(true);
  });
  it("parses quick titles", () => {
    expect(parseQuickTitle("Hades — Supergiant")).toEqual({ title: "Hades", creator: "Supergiant" });
    expect(parseQuickTitle("Spider-Man")).toEqual({ title: "Spider-Man", creator: "" });
  });
});
