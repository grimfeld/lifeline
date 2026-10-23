import { describe, expect, it } from "vitest";
import { barOf, flagsOf, monthStart, timelineWindow } from "./timeline";
import type { Milestone, Project } from "./types";

const base = { updatedAt: "2026-01-01T00:00:00.000Z", deleted: 0 as const, tags: [] as string[], folder: "", createdAt: "2026-01-10" };
const project = (extra: Partial<Project> = {}): Project => ({
  ...base, type: "project", id: "p", title: "Bathroom", stage: "active", outcome: "", start: null, deadline: null, startedOn: null, endedOn: null, emoji: "", color: "", rank: null, ...extra,
});
const milestone = (id: string, deadline: string | null, projectId = "p"): Milestone => ({ ...base, type: "project_milestone", id, title: id, project: projectId, rank: null, start: null, deadline, reachedOn: null });

describe("monthStart", () => {
  it("is the first of the month, shifted across years either way", () => {
    expect(monthStart("2026-10-23")).toBe("2026-10-01");
    expect(monthStart("2026-11-30", 3)).toBe("2027-02-01");
    expect(monthStart("2026-01-15", -1)).toBe("2025-12-01");
  });
});

describe("timelineWindow", () => {
  const { to, x } = timelineWindow("2026-09-01");
  it("runs six months, to the last day before the seventh", () => {
    expect(to).toBe("2027-02-28");
  });

  it("places a day across it in percent, pinning one outside to an edge", () => {
    expect(x("2026-09-01")).toBe(0);
    expect(x("2026-01-01")).toBe(0);
    expect(x("2030-01-01")).toBe(100);
    expect(x("2026-11-30")).toBeCloseTo((90 / 181) * 100);
  });
});

describe("barOf", () => {
  const [from, to, today] = ["2026-09-01", "2027-02-28", "2026-10-23"];

  it("runs from the start to the Deadline", () => {
    expect(barOf(project({ start: "2026-09-10", deadline: "2026-12-01" }), from, to, today)).toEqual({ a: "2026-09-10", b: "2026-12-01", visible: true, late: false });
  });

  it("falls back to the day it became Active, or was made, and ends where it ended, or starts", () => {
    expect(barOf(project({ startedOn: "2026-09-05", endedOn: "2026-10-01" }), from, to, today)).toMatchObject({ a: "2026-09-05", b: "2026-10-01" });
    expect(barOf(project({ deadline: "2026-12-01" }), from, to, today)).toMatchObject({ a: "2026-01-10", b: "2026-12-01" });
    expect(barOf(project({ start: "2026-11-01" }), from, to, today)).toMatchObject({ a: "2026-11-01", b: "2026-11-01" });
  });

  it("turns a Deadline before the start the right way round", () => {
    expect(barOf(project({ start: "2026-12-01", deadline: "2026-11-01" }), from, to, today)).toMatchObject({ a: "2026-11-01", b: "2026-12-01" });
  });

  it("is hidden wholly outside the window", () => {
    expect(barOf(project({ start: "2026-01-01", deadline: "2026-03-01" }), from, to, today).visible).toBe(false);
    expect(barOf(project({ start: "2026-01-01", deadline: "2027-06-01" }), from, to, today).visible).toBe(true);
  });

  it("is late only while open past its Deadline", () => {
    expect(barOf(project({ deadline: "2026-10-01" }), from, to, today).late).toBe(true);
    expect(barOf(project({ deadline: "2026-10-01", stage: "done" }), from, to, today).late).toBe(false);
    expect(barOf(project({ deadline: "2026-10-23" }), from, to, today).late).toBe(false);
  });
});

describe("flagsOf", () => {
  it("is the Project's Milestones with a Deadline in the window", () => {
    const ms = [milestone("in", "2026-10-01"), milestone("before", "2026-08-31"), milestone("none", null), milestone("other", "2026-10-01", "q")];
    expect(flagsOf(ms, "p", "2026-09-01", "2027-02-28").map((m) => m.id)).toEqual(["in"]);
  });
});
