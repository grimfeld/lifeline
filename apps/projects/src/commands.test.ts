import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  documentsOf,
  documentsTable,
  initApps,
  invokeCommand,
  type CommandDef,
} from "@lifeline/core";
import { addTask, TASK, taskTypes, type Task } from "@lifeline/app-tasks/data";
import { projectTypes } from "./types";
import { projectCommands } from "./commands";
import {
  PROJECT_LANE,
  PROJECT_MILESTONE,
  type Lane,
  type Milestone,
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
    expect([ms[2].start, ms[2].deadline]).toEqual(["2026-11-01", "2026-11-09"]);
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
    expect(err).toContain(m1.id);
    expect(err).toContain(m2.id);
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
    expect((await milestonesOf(pid))[0].reachedOn).toBe("2026-10-01");
    await run("projects.milestone.reach", {
      project: pid,
      milestone: "Phase",
      reached: false,
    });
    expect((await milestonesOf(pid))[0].reachedOn).toBeNull();
    await run("projects.milestone.reach", { project: pid, milestone: "Phase" });
    expect((await milestonesOf(pid))[0].reachedOn).not.toBeNull();
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
    await dropTask(task, doing, [], 0);
    await run("projects.lane.delete", { project: pid, lane: "Doing" });
    expect(await documentsOf<Lane>(PROJECT_LANE).then((l) => l.length)).toBe(2);
    const t = (await tasks()).find((x) => x.id === tid)!;
    expect(t.lane ?? todo.id).toBe(todo.id);
  });
});
