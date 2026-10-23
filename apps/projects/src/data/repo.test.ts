import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsOf, documentsTable, documentTypeSync, getDocument, initApps, invokeCommand, moveDocumentsToWorkspace, removeDocument } from "@lifeline/core";
import { addTask, setCompleted, setTaskProject, TASK, taskTypes, type Task } from "@lifeline/app-tasks/data";
import { projectTypes } from "../types";
import { PROJECT, PROJECT_LANE, PROJECT_MILESTONE, type Lane, type Milestone, type Project } from "../domain/types";
import { boardOf } from "../domain/board";
import { addMilestone, addProject, deleteLane, dropTask, lanesOf, milestonesOf, setDeadline, setReached, setStage } from "./repo";
import { projectsTimed } from "../timed";
import { projectCommands } from "../commands";

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
    expect([p!.stage, p!.startedOn, p!.endedOn]).toEqual(["done", "2026-03-01", "2026-03-09"]);
    await setStage(id, "active", "2026-03-10");
    expect((await documentsOf<Project>(PROJECT))[0]!.endedOn).toBeNull();
  });
});

describe("the Board", () => {
  it("ticks a Task dropped into the done Lane, and unticks it dragged out", async () => {
    const pid = await addProject({ title: "Bathroom" });
    const [todo, , done] = await lanesOf(pid);
    const tid = await addTask({ title: "Tile", project: pid });
    await dropTask(await one(tid), done!, [], 0);
    expect((await one(tid)).completedOn).not.toBeNull();
    await dropTask(await one(tid), todo!, [], 0);
    expect((await one(tid)).completedOn).toBeNull();
    expect((await one(tid)).lane).toBe(todo!.id);
  });

  it("rewrites the Lane's hand order whole when a Task lands in it", async () => {
    const pid = await addProject({ title: "Bathroom" });
    const lanes = await lanesOf(pid);
    const a = await addTask({ title: "a", project: pid });
    const b = await addTask({ title: "b", project: pid });
    const c = await addTask({ title: "c", project: pid });
    const col = boardOf(lanes, await tasks(), pid)[0];
    await dropTask(await one(c), lanes[0]!, col!.tasks, 0);
    const after = boardOf(lanes, await tasks(), pid)[0]!.tasks.map((t) => t.title);
    expect(after).toEqual(["c", "a", "b"]);
    expect(new Set([a, b, c]).size).toBe(3);
  });

  it("sends a deleted Lane's Tasks to the first Lane", async () => {
    const pid = await addProject({ title: "Bathroom" });
    const [todo, doing] = await lanesOf(pid);
    const tid = await addTask({ title: "Tile", project: pid });
    await dropTask(await one(tid), doing!, [], 0);
    await deleteLane(doing!);
    const cols = boardOf(await documentsOf<Lane>(PROJECT_LANE), await tasks(), pid);
    expect(cols[0]!.lane.id).toBe(todo!.id);
    expect(cols[0]!.tasks.map((t) => t.id)).toEqual([tid]);
  });
});

describe("a Task's Project", () => {
  it("changing Project drops the Milestone and the Lane", async () => {
    const p1 = await addProject({ title: "One" });
    const p2 = await addProject({ title: "Two" });
    const m = await addMilestone(p1, "Phase");
    const [, doing] = await lanesOf(p1);
    const tid = await addTask({ title: "t", project: p1, milestone: m });
    await dropTask(await one(tid), doing!, [], 0);
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

describe("agents", () => {
  it("see Deadlines on the agenda through itemsIn", async () => {
    const id = await addProject({ title: "Website" });
    await setDeadline(id, "2026-10-09");
    await addMilestone(id, "Copy done", "2026-10-05");
    const items = await projectsTimed.itemsIn!({ start: "2026-10-01", end: "2026-10-07" });
    expect(items.map((i) => [i.title.includes("Copy done"), i.date, i.marker])).toEqual([[true, "2026-10-05", true]]);
  });

  it("name a Project by its exact title in a headless Command's link argument", async () => {
    const id = await addProject({ title: "Website" });
    const def = {
      id: "t.add",
      title: "Add",
      args: [{ key: "project", label: "Project", kind: "link" as const, linkType: PROJECT }],
      invoke: async (a: Record<string, unknown>) => ({ id: a.project as string, message: "ok" }),
    };
    expect((await invokeCommand(def, { project: "website" })).id).toBe(id);
    expect((await invokeCommand(def, { project: id })).id).toBe(id);
    await expect(invokeCommand(def, { project: "Webside" })).rejects.toThrow("no project called");
  });

  it("read a Project's whole Board through get_document's description", async () => {
    const pid = await addProject({ title: "Bathroom", outcome: "A working shower", stage: "active", start: "2026-10-01", deadline: "2026-12-01", emoji: "🛁", color: "3" });
    const tiling = await addMilestone(pid, "Tiling", "2026-11-01");
    const plumbing = await addMilestone(pid, "Plumbing");
    await setReached((await milestonesOf(pid)).find((m) => m.id === plumbing)!, "2026-10-20");
    const [todo, doing, done] = await lanesOf(pid);
    const quote = await addTask({ title: "Tiling quote", project: pid, milestone: tiling });
    const tiles = await addTask({ title: "Buy tiles", project: pid, milestone: tiling, date: "2099-11-05" });
    await dropTask(await one(tiles), todo!, [], 0);
    await dropTask(await one(quote), todo!, [await one(tiles)], 0);
    const pipes = await addTask({ title: "Pipes", project: pid, milestone: plumbing });
    await dropTask(await one(pipes), done!, [], 0);
    const clean = await addTask({ title: "Clean", project: pid, recurrence: { kind: "weekly", weekdays: [1] } });

    const project = (await getDocument(pid))!;
    const detail = await documentTypeSync(PROJECT)!.describe!(project);
    expect(detail).toEqual({
      stage: "active",
      outcome: "A working shower",
      start: "2026-10-01",
      deadline: "2026-12-01",
      face: { emoji: "🛁", color: "3" },
      milestones: [
        { id: tiling, title: "Tiling", start: null, deadline: "2026-11-01", reachedOn: null, progress: { done: 0, total: 2 } },
        { id: plumbing, title: "Plumbing", start: null, deadline: null, reachedOn: "2026-10-20", progress: { done: 1, total: 1 } },
      ],
      lanes: [
        {
          id: todo!.id,
          title: "To do",
          done: false,
          tasks: [
            { id: quote, title: "Tiling quote", day: null, done: false, milestone: tiling },
            { id: tiles, title: "Buy tiles", day: "2099-11-05", done: false, milestone: tiling },
          ],
        },
        { id: doing!.id, title: "Doing", done: false, tasks: [] },
        { id: done!.id, title: "Done", done: true, tasks: [{ id: pipes, title: "Pipes", day: null, done: true, milestone: plumbing }] },
      ],
      recurring: [{ id: clean, title: "Clean", milestone: null }],
      next: { id: quote, title: "Tiling quote" },
    });
  });

  it("are answered for a Milestone or Lane by its Project", async () => {
    const pid = await addProject({ title: "Bathroom" });
    const mid = await addMilestone(pid, "Tiling");
    const [lane] = await lanesOf(pid);
    for (const id of [mid, lane!.id]) {
      const doc = (await getDocument(id))!;
      expect((await documentTypeSync(doc.type)!.owner!(doc))?.id).toBe(pid);
    }
  });
});

describe("agents run the Project Commands headless", () => {
  const run = (id: string, args: Record<string, unknown>) => invokeCommand(projectCommands.find((c) => c.id === id)!, args);
  const projects = async () => documentsOf<Project>(PROJECT);

  it("make a Project that starts with the three Lanes", async () => {
    const r = await run("projects.new", { title: "Bathroom", outcome: "Tiled", stage: "active", deadline: "2026-12-01", emoji: "🛁", color: "blue" });
    const p = (await projects()).find((x) => x.id === r.id)!;
    expect([p.title, p.outcome, p.stage, p.deadline, p.emoji, p.color]).toEqual(["Bathroom", "Tiled", "active", "2026-12-01", "🛁", "blue"]);
    expect((await lanesOf(r.id!)).map((l) => [l.title, l.done])).toEqual([["To do", false], ["Doing", false], ["Done", true]]);
  });

  it("refuse a Deadline before the start and a colour that is no slot", async () => {
    await expect(run("projects.new", { title: "X", start: "2026-05-02", deadline: "2026-05-01" })).rejects.toThrow("before");
    await expect(run("projects.new", { title: "X", color: "puce" })).rejects.toThrow("Colour");
  });

  it("edit only the fields given, naming the Project by title", async () => {
    const id = await addProject({ title: "Bathroom", outcome: "Tiled", deadline: "2026-12-01", emoji: "🛁" });
    await run("projects.edit", { project: "bathroom", deadline: "2027-01-15" });
    const p = (await projects())[0];
    expect([p!.id, p!.title, p!.outcome, p!.deadline, p!.emoji]).toEqual([id, "Bathroom", "Tiled", "2027-01-15", "🛁"]);
  });

  it("move a Project between open stages freely", async () => {
    const id = await addProject({ title: "Trip" });
    await run("projects.stage", { project: id, stage: "active" });
    await run("projects.stage", { project: id, stage: "paused" });
    expect((await projects())[0]!.stage).toBe("paused");
  });

  it("refuse Done with open Tasks unless told what becomes of them, naming the count", async () => {
    const id = await addProject({ title: "Trip" });
    await addTask({ title: "a", project: id });
    await addTask({ title: "b", project: id });
    await expect(run("projects.stage", { project: id, stage: "done" })).rejects.toThrow("2 open tasks");
    expect((await projects())[0]!.stage).toBe("planned");
  });

  it("leave, archive or release the open Tasks as asked", async () => {
    const mk = async (title: string) => {
      const id = await addProject({ title });
      const t = await addTask({ title: `${title} task`, project: id });
      const d = await addTask({ title: `${title} done`, project: id });
      await setCompleted(d, "2026-03-01");
      return { id, t, d };
    };
    const a = await mk("Leave");
    const b = await mk("Archive");
    const c = await mk("Loose");
    await run("projects.stage", { project: a.id, stage: "done", openTasks: "leave" });
    await run("projects.stage", { project: b.id, stage: "dropped", openTasks: "archive" });
    await run("projects.stage", { project: c.id, stage: "done", openTasks: "loose" });
    expect(await projects().then((ps) => ps.map((p) => p.stage).sort())).toEqual(["done", "done", "dropped"]);
    expect([(await one(a.t)).project, (await one(a.t)).status]).toEqual([a.id, "active"]);
    expect([(await one(b.t)).project, (await one(b.t)).status]).toEqual([b.id, "archived"]);
    expect([(await one(c.t)).project, (await one(c.d)).project]).toEqual([null, c.id]);
  });

  it("need no openTasks when none is open", async () => {
    const id = await addProject({ title: "Empty" });
    await run("projects.stage", { project: id, stage: "done" });
    expect((await projects())[0]!.stage).toBe("done");
  });
});
