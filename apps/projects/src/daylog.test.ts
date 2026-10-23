import { describe, expect, it } from "vitest";
import { daylogOf } from "./daylog";
import type { Milestone, Project } from "./domain/types";

const base = { updatedAt: "", deleted: 0 as const, tags: ["home"], folder: "", createdAt: "2026-01-01" };
const project = (id: string, extra: Partial<Project> = {}): Project => ({
  ...base, type: "project", id, title: id, stage: "active", outcome: "", start: null, deadline: null, startedOn: null, endedOn: null, emoji: "", color: "", rank: null, ...extra,
});
const reached = (id: string, projectId: string, on: string): Milestone => ({ ...base, type: "project_milestone", id, title: id, project: projectId, rank: null, start: null, deadline: null, reachedOn: on });

describe("the Projects Daylog (ADR 0060)", () => {
  const day = "2026-10-23";

  it("tells a Project started, a Project finished with its outcome, and a Milestone reached", () => {
    const items = daylogOf(
      [project("Bathroom", { startedOn: day }), project("Trip", { stage: "done", endedOn: day, outcome: "Went" })],
      [reached("Tiles", "Bathroom", day)],
      day,
    );
    expect(items.map((i) => [i.kind, i.title, i.subtitle])).toEqual([
      ["Started", "Bathroom", undefined],
      ["Finished", "Trip", "Went"],
      ["Reached", "Tiles", "Bathroom"],
    ]);
    expect(items[2].tags).toEqual(["home"]);
  });

  it("never tells a Project dropped, another day, or a Milestone of no Project", () => {
    const items = daylogOf([project("Shed", { stage: "dropped", endedOn: day }), project("Old", { startedOn: "2026-10-22" })], [reached("Lost", "gone", day)], day);
    expect(items).toEqual([]);
  });
});
