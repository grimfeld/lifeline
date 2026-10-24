import { describe, expect, it } from "vitest";
import type { Task } from "@lifeline/app-tasks/data";
import { boardOf, markersIn, nextTaskOf, parseMarkerId, progressOf, remainingEstimate } from "./board";
import type { Lane, Milestone, Project } from "./types";

const base = { updatedAt: "2026-01-01T00:00:00.000Z", deleted: 0 as const, tags: [] as string[], folder: "", createdAt: "2026-01-01" };

function task(id: string, extra: Partial<Task> = {}): Task {
  return {
    ...base,
    type: "task",
    id,
    title: id,
    notes: "",
    status: "active",
    date: null,
    completedOn: null,
    recurrence: null,
    estimate: null,
    project: "p",
    milestone: null,
    lane: null,
    rank: null,
    ...extra,
  };
}

function lane(id: string, rank: number, done = false, project = "p"): Lane {
  return { ...base, type: "project_lane", id, title: id, project, rank, done };
}

function project(id: string, extra: Partial<Project> = {}): Project {
  return {
    ...base,
    type: "project",
    id,
    title: id,
    stage: "active",
    outcome: "",
    start: null,
    deadline: null,
    startedOn: null,
    endedOn: null,
    emoji: "",
    color: "",
    rank: null,
    ...extra,
  };
}

function milestone(id: string, extra: Partial<Milestone> = {}): Milestone {
  return { ...base, type: "project_milestone", id, title: id, project: "p", rank: 1, start: null, deadline: null, reachedOn: null, ...extra };
}

const LANES = [lane("todo", 1000), lane("doing", 2000), lane("done", 3000, true)];

describe("progress", () => {
  it("counts one-time Tasks of the Project only: recurring and archived Tasks count for nothing", () => {
    const tasks = [
      task("a", { completedOn: "2026-02-01" }),
      task("b"),
      task("r", { recurrence: { kind: "weekly", weekdays: [1] } }),
      task("x", { status: "archived" }),
      task("other", { project: "q", completedOn: "2026-02-01" }),
    ];
    expect(progressOf(tasks, "p")).toEqual({ done: 1, total: 2 });
  });

  it("narrows to one Milestone", () => {
    const tasks = [task("a", { milestone: "m1", completedOn: "2026-02-01" }), task("b", { milestone: "m2" })];
    expect(progressOf(tasks, "p", "m1")).toEqual({ done: 1, total: 1 });
  });

  it("sums the Estimates still open", () => {
    const tasks = [task("a", { estimate: 30 }), task("b", { estimate: 45, completedOn: "2026-02-01" }), task("c", { estimate: 15 })];
    expect(remainingEstimate(tasks, "p")).toBe(45);
  });
});

describe("the Board", () => {
  it("puts a Task without a Lane, or with a deleted one, in the first Lane", () => {
    const cols = boardOf(LANES, [task("a"), task("b", { lane: "gone" })], "p");
    expect(cols.map((c) => c.tasks.map((t) => t.id))).toEqual([["a", "b"], [], []]);
  });

  it("stands a ticked Task in the done Lane whatever its own Lane says", () => {
    const cols = boardOf(LANES, [task("a", { lane: "doing", completedOn: "2026-02-01" })], "p");
    expect(cols[2]!.tasks.map((t) => t.id)).toEqual(["a"]);
  });

  it("returns an unticked Task in the done Lane to the first Lane", () => {
    const cols = boardOf(LANES, [task("a", { lane: "done" })], "p");
    expect(cols[0]!.tasks.map((t) => t.id)).toEqual(["a"]);
  });

  it("orders each Lane by hand rank, unranked last", () => {
    const cols = boardOf(LANES, [task("a"), task("b", { rank: 2000 }), task("c", { rank: 1000 })], "p");
    expect(cols[0]!.tasks.map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("leaves recurring Tasks and other Projects' Lanes off", () => {
    const cols = boardOf([...LANES, lane("q1", 500, false, "q")], [task("r", { recurrence: { kind: "monthly", days: [1] } })], "p");
    expect(cols).toHaveLength(3);
    expect(cols.flatMap((c) => c.tasks)).toEqual([]);
  });
});

describe("the next Task", () => {
  it("is a Task due today or overdue before anything on the Board", () => {
    const tasks = [task("top", { rank: 1 }), task("late", { date: "2026-02-01", lane: "doing" })];
    expect(nextTaskOf(LANES, tasks, "p", "2026-02-03")?.id).toBe("late");
  });

  it("else the top of the first Lane holding any, never the done Lane", () => {
    const tasks = [task("d", { lane: "doing", rank: 5 }), task("x", { completedOn: "2026-02-01" })];
    expect(nextTaskOf(LANES, tasks, "p", "2026-02-03")?.id).toBe("d");
    expect(nextTaskOf(LANES, [task("x", { completedOn: "2026-02-01" })], "p", "2026-02-03")).toBeUndefined();
  });
});

describe("Deadline markers", () => {
  const range = { start: "2026-03-01", end: "2026-03-31" };

  it("stand for open Projects and their unreached Milestones only", () => {
    const projects = [project("p", { deadline: "2026-03-10" }), project("done", { stage: "done", deadline: "2026-03-11" })];
    const milestones = [
      milestone("m1", { deadline: "2026-03-05" }),
      milestone("m2", { deadline: "2026-03-06", reachedOn: "2026-03-01" }),
      milestone("m3", { project: "done", deadline: "2026-03-07" }),
      milestone("m4", { deadline: "2026-04-07" }),
    ];
    const out = markersIn(projects, milestones, range);
    expect(out.map((m) => [m.itemId, m.date])).toEqual([
      ["p", "2026-03-10"],
      ["p:m1", "2026-03-05"],
    ]);
    expect(out.every((m) => m.marker && m.start === null)).toBe(true);
  });

  it("name their Project in the item id, so a Milestone's opens its Project", () => {
    expect(parseMarkerId("p:m1")).toEqual({ projectId: "p", milestoneId: "m1" });
    expect(parseMarkerId("p")).toEqual({ projectId: "p", milestoneId: null });
  });
});
