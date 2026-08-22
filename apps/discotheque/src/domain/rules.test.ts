import { describe, expect, it } from "vitest";
import { onShelf, shelfLabel } from "./browse";
import { parseQuickTitle } from "../data/repo";
import type { Work } from "./types";
import { abandon, finish, start } from "./rules";

function item(p: Partial<Work>): Work {
  return {
    id: p.id ?? "x", updatedAt: "", deleted: 0, type: "music", title: "t", tags: [], folder: "", createdAt: "2026-01-01",
    creator: "", externalKey: "", coverUrl: "", size: 0, year: 0, engagement: "UNSTARTED",
    reason: "", addedOn: "2026-01-01", startedOn: "", finishedOn: "", ...p,
  } as Work;
}

describe("transitions", () => {
  it("start/finish stamp their days; abandon does not", () => {
    expect(start("2026-08-16")).toEqual({ engagement: "IN_PROGRESS", startedOn: "2026-08-16" });
    expect(finish("2026-08-16")).toEqual({ engagement: "DONE", finishedOn: "2026-08-16" });
    expect(abandon()).toEqual({ engagement: "ABANDONED" });
  });
});

describe("shelf", () => {
  it("labels use the Discotheque's verbs", () => {
    expect(shelfLabel("UNSTARTED", "music")).toBe("To listen");
    expect(shelfLabel("ABANDONED", "music")).toBe("Dropped");
    expect(onShelf(item({ engagement: "DONE" }), "DONE")).toBe(true);
    expect(onShelf(item({ engagement: "DONE" }), "ALL")).toBe(true);
  });
  it("parses quick titles", () => {
    expect(parseQuickTitle("Heat by Michael Mann")).toEqual({ title: "Heat", creator: "Michael Mann" });
    expect(parseQuickTitle("Heat")).toEqual({ title: "Heat", creator: "" });
  });
});
