import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, initApps, moveDocumentsToWorkspace, removeDocument } from "@lifeline/core";
import { addTask, setCompleted, setTaskProject, TASK, taskTypes, type Task } from "@lifeline/app-tasks/data";
import { projectTypes } from "../types";
import { PROJECT, PROJECT_LANE, PROJECT_MILESTONE, type Lane, type Milestone, type Project } from "../domain/types";
import { boardOf } from "../domain/board";
import { addMilestone, addProject, deleteLane, dropTask, lanesOf, setStage } from "./repo";

initApps([
  { id: "tasks", title: "Tasks", types: taskTypes, screens: [], cards: [], commands: [] },
  { id: "projects", title: "Projects", types: projectTypes, screens: [], cards: [], commands: [] },
]);

const tasks = async () => documentsOf<Task>(TASK);
const one = async (id: string) => (await tasks()).find((t) => t.id === id)!;

beforeEach(async () => {
  await documentsTable().clear();
});

describe("a new Project", () => {
  it("starts its Board with To do, Doing and a done Lane called Done", async () => {
    const id = await addProject({ title: "Bathroom" });
    const lanes = await lanesOf(id);
    expect(lanes.map((l) => [l.title, l.done])).toEqual([
      ["To do", false],
      ["Doing", false],
      ["Done", true],
    ]);
  });

  it("stamps the days it started and ended as its stage moves", async () => {
    const id = await addProject({ title: "Trip", stage: "planned" });
    await setStage(id, "active", "2026-03-01");
    await setStage(id, "done", "2026-03-09");
    const p = (await documentsOf<Project>(PROJECT))[0];
    expect([p.stage, p.startedOn, p.endedOn]).toEqual(["done", "2026-03-01", "2026-03-09"]);
    await setStage(id, "active", "2026-03-10");
    expect((await documentsOf<Project>(PROJECT))[0].endedOn).toBeNull();
  });
});

describe("the Board", () => {
  it("ticks a Task dropped into the done Lane, and unticks it dragged out", async () => {
    const pid = await addProject({ title: "Bathroom" });
    const [todo, , done] = await lanesOf(pid);
    const tid = await addTask({ title: "Tile", project: pid });
    await dropTask(await one(tid), done, [], 0);
    expect((await one(tid)).completedOn).not.toBeNull();
    await dropTask(await one(tid), todo, [], 0);
    expect((await one(tid)).completedOn).toBeNull();
    expect((await one(tid)).lane).toBe(todo.id);
  });

  it("rewrites the Lane's hand order whole when a Task lands in it", async () => {
    const pid = await addProject({ title: "Bathroom" });
    const lanes = await lanesOf(pid);
    const a = await addTask({ title: "a", project: pid });
    const b = await addTask({ title: "b", project: pid });
    const c = await addTask({ title: "c", project: pid });
    const col = boardOf(lanes, await tasks(), pid)[0];
    await dropTask(await one(c), lanes[0], col.tasks, 0);
    const after = boardOf(lanes, await tasks(), pid)[0].tasks.map((t) => t.title);
    expect(after).toEqual(["c", "a", "b"]);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("sends a deleted Lane's Tasks to the first Lane", async () => {
    const pid = await addProject({ title: "Bathroom" });
    const [todo, doing] = await lanesOf(pid);
    const tid = await addTask({ title: "Tile", project: pid });
    await dropTask(await one(tid), doing, [], 0);
    await deleteLane(doing);
    const cols = boardOf(await documentsOf<Lane>(PROJECT_LANE), await tasks(), pid);
    expect(cols[0].lane.id).toBe(todo.id);
    expect(cols[0].tasks.map((t) => t.id)).toEqual([tid]);
  });
});

describe("a Task's Project", () => {
  it("changing Project drops the Milestone and the Lane", async () => {
    const p1 = await addProject({ title: "One" });
    const p2 = await addProject({ title: "Two" });
    const m = await addMilestone(p1, "Phase");
    const [, doing] = await lanesOf(p1);
    const tid = await addTask({ title: "t", project: p1, milestone: m });
    await dropTask(await one(tid), doing, [], 0);
    await setTaskProject(tid, p2);
    const t = await one(tid);
    expect([t.project, t.milestone, t.lane, t.rank]).toEqual([p2, null, null, null]);
  });
});

describe("deleting a Project", () => {
  it("releases its Tasks as loose Tasks and takes its Milestones and Lanes", async () => {
    const pid = await addProject({ title: "Mistake" });
    const m = await addMilestone(pid, "Phase");
    const tid = await addTask({ title: "Real work", project: pid, milestone: m });
    await setCompleted(tid, "2026-03-01");
    await removeDocument(pid);
    const t = await one(tid);
    expect([t.project, t.milestone, t.completedOn]).toEqual([null, null, "2026-03-01"]);
    expect(await documentsOf<Milestone>(PROJECT_MILESTONE)).toEqual([]);
    expect(await documentsOf<Lane>(PROJECT_LANE)).toEqual([]);
  });
});

describe("moving a Project to another Workspace", () => {
  it("takes its Milestones, Lanes and Tasks in the same act, and nothing else", async () => {
    const pid = await addProject({ title: "Work thing" });
    await addMilestone(pid, "Phase");
    const tid = await addTask({ title: "Do it", project: pid });
    const loose = await addTask({ title: "Unrelated" });
    await moveDocumentsToWorkspace([pid], "work");
    const rows = await documentsTable().toArray();
    const ws = (id: string) => rows.find((r) => r.id === id)?.workspace ?? "";
    expect(ws(pid)).toBe("work");
    expect(ws(tid)).toBe("work");
    expect(ws(loose)).toBe("");
    expect(rows.filter((r) => r.type === PROJECT_LANE || r.type === PROJECT_MILESTONE).every((r) => r.workspace === "work")).toBe(true);
  });
});
