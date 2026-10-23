import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  documentsOf,
  documentsTable,
  initApps,
  invokeCommand,
  type CommandDef,
} from "@lifeline/core";
import { tasksApp } from "@lifeline/app-tasks";
import { addTask, TASK, taskTypes, type Task } from "@lifeline/app-tasks/data";
import { projectTypes } from "./types";
import { projectCommands } from "./commands";
import {
  PROJECT,
  PROJECT_LANE,
  PROJECT_MILESTONE,
  type Lane,
  type Milestone,
  type Project,
} from "./domain/types";
import { addProject, lanesOf, dropTask, milestonesOf } from "./data/repo";

initApps([
  {
    id: "tasks",
    title: "Tasks",
    types: taskTypes,
    screens: [],
    cards: [],
    commands: [],
  },
  {
    id: "projects",
    title: "Projects",
    types: projectTypes,
    screens: [],
    cards: [],
    commands: projectCommands,
  },
]);

const run = (id: string, args: Record<string, unknown>) => {
  const def = projectCommands.find((c) => c.id === id) as CommandDef;
  return invokeCommand(def, args);
};
const tasks = () => documentsOf<Task>(TASK);

beforeEach(async () => {
  await documentsTable().clear();
});

describe("Milestone Commands, run headless", () => {
  it("add a Milestone at a position, by Project title", async () => {
    const pid = await addProject({ title: "Bathroom" });
    await run("projects.milestone.add", {
      project: "bathroom",
      title: "Demolition",
    });
    await run("projects.milestone.add", {
      project: pid,
      title: "Tiling",
      start: "2026-11-01",
      deadline: "2026-11-09",
    });
    await run("projects.milestone.add", {
      project: pid,
      title: "First",
      position: 0,
    });
    const ms = await milestonesOf(pid);
    expect(ms.map((m) => m.title)).toEqual(["First", "Demolition", "Tiling"]);
    expect([ms[2]!.start, ms[2]!.deadline]).toEqual(["2026-11-01", "2026-11-09"]);
  });

  it("edit and reorder by title, looked up only among the Project's own", async () => {
    const a = await addProject({ title: "A" });
    const b = await addProject({ title: "B" });
    for (const p of [a, b])
      for (const t of ["One", "Two", "Three"])
        await run("projects.milestone.add", { project: p, title: t });
    await run("projects.milestone.edit", {
      project: "A",
      milestone: "three",
      title: "Third",
      position: 0,
    });
    expect((await milestonesOf(a)).map((m) => m.title)).toEqual([
      "Third",
      "One",
      "Two",
    ]);
    expect((await milestonesOf(b)).map((m) => m.title)).toEqual([
      "One",
      "Two",
      "Three",
    ]);
  });

  it("refuse an ambiguous title with the candidates, and an unknown one", async () => {
    const pid = await addProject({ title: "A" });
    await run("projects.milestone.add", { project: pid, title: "Phase" });
    await run("projects.milestone.add", { project: pid, title: "phase" });
    const [m1, m2] = await milestonesOf(pid);
    const err = await run("projects.milestone.edit", {
      project: pid,
      milestone: "Phase",
      title: "x",
    }).catch((e: Error) => e.message);
    expect(err).toContain(m1!.id);
    expect(err).toContain(m2!.id);
    await expect(
      run("projects.milestone.edit", {
        project: pid,
        milestone: "Nope",
        title: "x",
      }),
    ).rejects.toThrow(/no milestone/i);
  });

  it("reach, on a day or today, and unreach", async () => {
    const pid = await addProject({ title: "A" });
    await run("projects.milestone.add", { project: pid, title: "Phase" });
    await run("projects.milestone.reach", {
      project: pid,
      milestone: "Phase",
      on: "2026-10-01",
    });
    expect((await milestonesOf(pid))[0]!.reachedOn).toBe("2026-10-01");
    await run("projects.milestone.reach", {
      project: pid,
      milestone: "Phase",
      reached: false,
    });
    expect((await milestonesOf(pid))[0]!.reachedOn).toBeNull();
    await run("projects.milestone.reach", { project: pid, milestone: "Phase" });
    expect((await milestonesOf(pid))[0]!.reachedOn).not.toBeNull();
  });

  it("delete keeps its Tasks in the Project", async () => {
    const pid = await addProject({ title: "A" });
    const mid = (
      await run("projects.milestone.add", { project: pid, title: "Phase" })
    ).id!;
    const tid = await addTask({ title: "t", project: pid, milestone: mid });
    await run("projects.milestone.delete", {
      project: pid,
      milestone: "Phase",
    });
    expect(await documentsOf<Milestone>(PROJECT_MILESTONE)).toEqual([]);
    const t = (await tasks()).find((x) => x.id === tid)!;
    expect([t.project, t.milestone]).toEqual([pid, null]);
  });
});

describe("Lane Commands, run headless", () => {
  it("'To do' never resolves to another Project's Lane", async () => {
    const a = await addProject({ title: "A" });
    const b = await addProject({ title: "B" });
    await run("projects.lane.edit", {
      project: "B",
      lane: "To do",
      title: "Backlog",
    });
    expect((await lanesOf(a)).map((l) => l.title)).toEqual([
      "To do",
      "Doing",
      "Done",
    ]);
    expect((await lanesOf(b)).map((l) => l.title)).toEqual([
      "Backlog",
      "Doing",
      "Done",
    ]);
  });

  it("add at a position; the done Lane stays last by default", async () => {
    const pid = await addProject({ title: "A" });
    await run("projects.lane.add", { project: pid, title: "Review" });
    await run("projects.lane.add", {
      project: pid,
      title: "Inbox",
      position: 0,
    });
    expect((await lanesOf(pid)).map((l) => l.title)).toEqual([
      "Inbox",
      "To do",
      "Doing",
      "Review",
      "Done",
    ]);
  });

  it("making a Lane done unmarks the other", async () => {
    const pid = await addProject({ title: "A" });
    await run("projects.lane.edit", {
      project: pid,
      lane: "Doing",
      done: true,
    });
    expect((await lanesOf(pid)).map((l) => [l.title, l.done])).toEqual([
      ["To do", false],
      ["Doing", true],
      ["Done", false],
    ]);
  });

  it("delete sends its Tasks to the first Lane", async () => {
    const pid = await addProject({ title: "A" });
    const [todo, doing] = await lanesOf(pid);
    const tid = await addTask({ title: "t", project: pid });
    const task = (await tasks()).find((x) => x.id === tid)!;
    await dropTask(task, doing!, [], 0);
    await run("projects.lane.delete", { project: pid, lane: "Doing" });
    expect(await documentsOf<Lane>(PROJECT_LANE).then((l) => l.length)).toBe(2);
    const t = (await tasks()).find((x) => x.id === tid)!;
    expect(t.lane ?? todo!.id).toBe(todo!.id);
  });
});

describe("Place task, run headless", () => {
  const place = (args: Record<string, unknown>) =>
    run("projects.task.place", args);
  const one = async (id: string) => (await tasks()).find((t) => t.id === id)!;
  const inLane = async (laneId: string) =>
    (await tasks())
      .filter((t) => t.lane === laneId)
      .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
      .map((t) => t.title);

  it("puts a Task in a Project, Milestone and Lane, at the bottom by default", async () => {
    const pid = await addProject({ title: "Bathroom" });
    await run("projects.milestone.add", { project: pid, title: "Tiling" });
    const [, doing] = await lanesOf(pid);
    const a = await addTask({ title: "a" });
    const b = await addTask({ title: "b" });
    await place({ task: a, project: "bathroom", milestone: "tiling", lane: "Doing" });
    await place({ task: b, project: pid, lane: "doing" });
    const ta = await one(a);
    expect([ta.project, ta.lane]).toEqual([pid, doing!.id]);
    expect(ta.milestone).toBe((await milestonesOf(pid))[0]!.id);
    expect(await inLane(doing!.id)).toEqual(["a", "b"]);
  });

  it("a position puts it at that place in the Lane's hand order", async () => {
    const pid = await addProject({ title: "P" });
    const ids = [] as string[];
    for (const t of ["a", "b", "c"]) {
      const id = await addTask({ title: t });
      await place({ task: id, project: pid, lane: "To do" });
      ids.push(id);
    }
    await place({ task: ids[2], lane: "To do", position: 0 });
    const [todo] = await lanesOf(pid);
    expect(await inLane(todo!.id)).toEqual(["c", "a", "b"]);
    await place({ task: ids[2], position: 99 });
    expect(await inLane(todo!.id)).toEqual(["a", "b", "c"]);
  });

  it("into the done Lane ticks it, out of it unticks it", async () => {
    const pid = await addProject({ title: "P" });
    const id = await addTask({ title: "t", project: pid });
    await place({ task: id, lane: "Done" });
    expect((await one(id)).completedOn).not.toBeNull();
    await place({ task: id, lane: "Doing" });
    expect((await one(id)).completedOn).toBeNull();
  });

  it("changing Project drops the Milestone and lands in the first Lane", async () => {
    const a = await addProject({ title: "A" });
    const b = await addProject({ title: "B" });
    await run("projects.milestone.add", { project: a, title: "M" });
    await run("projects.milestone.add", { project: b, title: "N" });
    const id = await addTask({ title: "t", project: a });
    await place({ task: id, milestone: "M" });
    expect((await one(id)).milestone).not.toBeNull();
    await place({ task: id, project: b });
    const t = await one(id);
    expect([t.project, t.milestone]).toEqual([b, null]);
    expect(t.lane).toBe((await lanesOf(b))[0]!.id);
    await place({ task: id, project: a, milestone: "M" });
    expect((await one(id)).milestone).toBe((await milestonesOf(a))[0]!.id);
  });

  it("loose takes a Task out of its Project", async () => {
    const pid = await addProject({ title: "P" });
    const id = await addTask({ title: "t", project: pid });
    await place({ task: id, loose: true });
    const t = await one(id);
    expect([t.project, t.milestone, t.lane]).toEqual([null, null, null]);
    await expect(place({ task: id, loose: true, lane: "Doing" })).rejects.toThrow();
  });

  it("a loose Task needs a Project to take a Lane", async () => {
    const id = await addTask({ title: "t" });
    await expect(place({ task: id, lane: "Doing" })).rejects.toThrow(/project/i);
  });

  it("a recurring Task is refused a Lane but takes a Project and Milestone", async () => {
    const pid = await addProject({ title: "P" });
    await run("projects.milestone.add", { project: pid, title: "M" });
    const id = await addTask({
      title: "r",
      recurrence: { freq: "daily", interval: 1 } as never,
    });
    await expect(place({ task: id, project: pid, lane: "Doing" })).rejects.toThrow(/lane/i);
    await place({ task: id, project: pid, milestone: "M" });
    const t = await one(id);
    expect([t.project, t.lane]).toEqual([pid, null]);
    expect(t.milestone).not.toBeNull();
  });

  it("a Lane of another Project is not found", async () => {
    const a = await addProject({ title: "A" });
    await addProject({ title: "B" });
    const id = await addTask({ title: "t" });
    await place({ task: id, project: a, lane: "To do" });
    await expect(place({ task: id, project: a, lane: "Nope" })).rejects.toThrow(/No lane/);
  });
});

describe("tasks.add with a Milestone and a Lane, run headless", () => {
  const add = (args: Record<string, unknown>) =>
    invokeCommand(
      tasksApp.commands.find((c) => c.id === "tasks.add") as CommandDef,
      args,
    );

  it("places the new Task in the Milestone and Lane of its Project", async () => {
    const pid = await addProject({ title: "Bathroom" });
    await run("projects.milestone.add", { project: pid, title: "Tiling" });
    const { id } = await add({ title: "Quote", project: "Bathroom", milestone: "tiling", lane: "Doing" });
    const t = (await tasks()).find((x) => x.id === id)!;
    expect(t.milestone).toBe((await milestonesOf(pid))[0]!.id);
    expect(t.lane).toBe((await lanesOf(pid))[1]!.id);
  });

  it("refuses either without a Project", async () => {
    await expect(add({ title: "x", lane: "Doing" })).rejects.toThrow(/project/i);
    await expect(add({ title: "x", milestone: "M" })).rejects.toThrow(/project/i);
  });

  it("a recurring Task is refused a Lane and is never ticked", async () => {
    const pid = await addProject({ title: "P" });
    const recurrence = { kind: "weekly", weekdays: [1] };
    await expect(add({ title: "r", project: pid, lane: "Done", recurrence })).rejects.toThrow(/lane/i);
    expect(await tasks()).toEqual([]);
    const { id } = await add({ title: "r", project: pid, recurrence });
    const t = (await tasks()).find((x) => x.id === id)!;
    expect([t.project, t.lane, t.completedOn]).toEqual([pid, null, null]);
  });

  it("a Lane that is not the Project's is refused", async () => {
    await addProject({ title: "P" });
    await expect(add({ title: "x", project: "P", lane: "Nope" })).rejects.toThrow(/No lane/);
  });

  it("into the done Lane it is ticked", async () => {
    const pid = await addProject({ title: "P" });
    const { id } = await add({ title: "x", project: pid, lane: "Done" });
    expect((await tasks()).find((x) => x.id === id)!.completedOn).not.toBeNull();
  });
});

describe("Clearing fields, run headless", () => {
  const getP = async (id: string) => (await documentsOf<Project>(PROJECT)).find((p) => p.id === id)!;

  it("Edit project empties the fields named in clear", async () => {
    const pid = await addProject({ title: "P", outcome: "o", start: "2026-01-01", deadline: "2026-02-01", emoji: "🛁", color: "teal" });
    await run("projects.edit", { project: pid, clear: ["outcome", "start", "deadline", "emoji", "color"] });
    const p = await getP(pid);
    expect([p.outcome, p.start, p.deadline, p.emoji, p.color]).toEqual(["", null, null, "", ""]);
  });

  it("clearing the start lets a lone deadline stand", async () => {
    const pid = await addProject({ title: "P", start: "2026-03-01", deadline: "2026-04-01" });
    await run("projects.edit", { project: pid, start: undefined, deadline: "2026-02-01", clear: ["start"] });
    expect((await getP(pid)).deadline).toBe("2026-02-01");
  });

  it("a field both given and cleared is refused", async () => {
    const pid = await addProject({ title: "P", outcome: "o" });
    await expect(run("projects.edit", { project: pid, outcome: "x", clear: ["outcome"] })).rejects.toThrow(/both given and cleared/);
    expect((await getP(pid)).outcome).toBe("o");
  });

  it("Edit milestone empties its start and deadline", async () => {
    const pid = await addProject({ title: "P" });
    await run("projects.milestone.add", { project: pid, title: "M", start: "2026-01-01", deadline: "2026-02-01" });
    await run("projects.milestone.edit", { project: pid, milestone: "M", clear: ["start", "deadline"] });
    const m = (await milestonesOf(pid))[0];
    expect([m!.start, m!.deadline]).toEqual([null, null]);
    await expect(run("projects.milestone.edit", { project: pid, milestone: "M", start: "2026-01-01", clear: ["start"] })).rejects.toThrow(/both given and cleared/);
  });

  it("Place task removes the Milestone and keeps the Project", async () => {
    const pid = await addProject({ title: "P" });
    await run("projects.milestone.add", { project: pid, title: "M" });
    const id = await addTask({ title: "t" });
    await run("projects.task.place", { task: id, project: pid, milestone: "M" });
    await run("projects.task.place", { task: id, clear: ["milestone"] });
    const t = (await tasks()).find((x) => x.id === id)!;
    expect([t.project, t.milestone]).toEqual([pid, null]);
    await expect(run("projects.task.place", { task: id, milestone: "M", clear: ["milestone"] })).rejects.toThrow(/both given and cleared/);
    await expect(run("projects.task.place", { task: id, loose: true, clear: ["milestone"] })).rejects.toThrow(/Loose/);
  });
});
