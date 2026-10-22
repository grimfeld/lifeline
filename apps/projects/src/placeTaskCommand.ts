import { documentsOf, getDocument, type CommandArg, type CommandDef } from "@lifeline/core";
import { resolveInProject, setTaskProject, TASK, type Task } from "@lifeline/app-tasks/data";
import { KanbanSquare } from "lucide-react";
import { PROJECT } from "./domain/types";
import { boardOf } from "./domain/board";
import { dropTask, lanesOf } from "./data/repo";

/**
 * Headless Command that puts a Task on a Project's Board (ADR 0062): its
 * Project, Milestone, Lane and place in the Lane. Lane moves run the Board's own
 * drop operation, so the done Lane ticks and unticks and the hand order is
 * rewritten as the screen does.
 */

const args: CommandArg[] = [
  { key: "task", label: "Task", kind: "link", linkType: TASK, required: true, hint: "The Task, by id or title." },
  {
    key: "project",
    label: "Project",
    kind: "link",
    linkType: PROJECT,
    hint: "The Project to put it in. Omit to keep its own. Changing Project drops the Milestone (unless one of the new Project's is given) and puts it in the new Project's first Lane.",
  },
  { key: "milestone", label: "Milestone", kind: "text", hint: "One of the Project's Milestones, by id or title." },
  { key: "lane", label: "Lane", kind: "text", hint: "One of the Project's Lanes, by id or title. A recurring Task has none. The done Lane ticks the Task; any other unticks it." },
  { key: "position", label: "Position", kind: "number", hint: "0-based place in the Lane's hand order (order is priority); 0 is top. Omit to put it at the bottom." },
  { key: "loose", label: "Loose", kind: "boolean", hint: "true takes the Task out of its Project, making it a loose Task. Cannot be combined with the others." },
];

export const placeTaskCommand: CommandDef = {
  id: "projects.task.place",
  title: "Place task",
  keywords: ["project", "task", "board", "lane", "kanban", "move", "milestone", "loose"],
  icon: KanbanSquare,
  args,
  returnsDocument: true,
  async invoke(a) {
    const id = a.task as string;
    const get = async () => (await getDocument<Task>(id))!;
    const task = await get();
    const wantsPlace = a.project !== undefined || a.milestone !== undefined || a.lane !== undefined || a.position !== undefined;
    if (a.loose === true) {
      if (wantsPlace) throw new Error("Loose: a Task taken out of its Project takes no Project, Milestone, Lane or position");
      await setTaskProject(id, null);
      return { id, message: `“${task.title}” is now a loose task` };
    }
    const projectId = (a.project as string | undefined) ?? task.project;
    if (!projectId) throw new Error(`“${task.title}” is a loose task: say which project to put it in`);
    const changed = task.project !== projectId;
    const position = a.position as number | undefined;
    if (position !== undefined && (!Number.isInteger(position) || position < 0)) throw new Error("Position: expected a whole number from 0");
    if (task.recurrence && (a.lane !== undefined || position !== undefined)) {
      throw new Error("Lane: a recurring task stands in no Lane; it may take a Project and a Milestone");
    }
    const milestone = a.milestone !== undefined ? await resolveInProject("milestone", projectId, a.milestone as string) : undefined;
    const lane = a.lane !== undefined ? await resolveInProject("lane", projectId, a.lane as string) : undefined;

    if (changed) await setTaskProject(id, projectId, milestone ?? null);
    else if (milestone !== undefined) await setTaskProject(id, projectId, milestone);
    if (task.recurrence) return { id, message: `Placed “${task.title}” in its project` };

    if (changed || lane !== undefined || position !== undefined) {
      const lanes = await lanesOf(projectId);
      const board = boardOf(lanes, await documentsOf<Task>(TASK), projectId);
      const current = board.find((c) => c.tasks.some((t) => t.id === id));
      const target = lane !== undefined ? board.find((c) => c.lane.id === lane) : changed ? board[0] : current;
      if (target) {
        await dropTask(await get(), target.lane, target.tasks, position ?? target.tasks.length);
        return { id, message: `Placed “${task.title}” in ${target.lane.title}` };
      }
    }
    return { id, message: `Placed “${task.title}” in its project` };
  },
};
