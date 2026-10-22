import {
  todayStr,
  type CommandArg,
  type CommandDef,
  type DateStr,
} from "@lifeline/core";
import { resolveInProject } from "@lifeline/app-tasks/data";
import { Flag, Columns3 } from "lucide-react";
import { PROJECT } from "./domain/types";
import {
  addLane,
  addMilestone,
  deleteLane,
  deleteMilestone,
  lanesOf,
  milestonesOf,
  renameLane,
  setDoneLane,
  setLanePosition,
  setMilestonePosition,
  setReached,
  updateMilestone,
} from "./data/repo";

/**
 * Headless Commands that shape a Project's Milestones and the Lanes of its Board
 * (ADR 0062). Each runs the repo operation the Project screen runs. A Milestone
 * or Lane is named by id or title, looked up only among the given Project's own.
 */

const project: CommandArg = {
  key: "project",
  label: "Project",
  kind: "link",
  linkType: PROJECT,
  required: true,
  hint: "The Project, by id or title.",
};
const milestone: CommandArg = {
  key: "milestone",
  label: "Milestone",
  kind: "text",
  required: true,
  hint: "The Milestone, by id or title, among the Project's own. An ambiguous title is refused with the candidates.",
};
const lane: CommandArg = {
  key: "lane",
  label: "Lane",
  kind: "text",
  required: true,
  hint: "The Lane, by id or title, among the Project's own. An ambiguous title is refused with the candidates.",
};
const position = (what: string): CommandArg => ({
  key: "position",
  label: "Position",
  kind: "number",
  hint: `0-based place in the ${what} order; 0 is first. Omit to leave it (when adding: last).`,
});
const start: CommandArg = { key: "start", label: "Start", kind: "date" };
const deadline: CommandArg = {
  key: "deadline",
  label: "Deadline",
  kind: "date",
};

const pos = (a: Record<string, unknown>): number | undefined => {
  const n = a.position as number | undefined;
  if (n !== undefined && (!Number.isInteger(n) || n < 0))
    throw new Error("Position: expected a whole number from 0");
  return n;
};

async function milestoneOf(a: Record<string, unknown>) {
  const id = await resolveInProject(
    "milestone",
    a.project as string,
    a.milestone as string,
  );
  return (await milestonesOf(a.project as string)).find((x) => x.id === id)!;
}
async function laneOf(a: Record<string, unknown>) {
  const id = await resolveInProject(
    "lane",
    a.project as string,
    a.lane as string,
  );
  return (await lanesOf(a.project as string)).find((x) => x.id === id)!;
}

export const milestoneLaneCommands: CommandDef[] = [
  {
    id: "projects.milestone.add",
    title: "Add milestone",
    keywords: ["project", "milestone", "checkpoint", "phase"],
    icon: Flag,
    args: [
      project,
      { key: "title", label: "Title", kind: "text", required: true },
      start,
      deadline,
      position("Project's Milestones"),
    ],
    returnsDocument: true,
    async invoke(a) {
      const title = a.title as string;
      const id = await addMilestone(
        a.project as string,
        title,
        (a.deadline as DateStr | undefined) ?? null,
        {
          start: (a.start as DateStr | undefined) ?? null,
          position: pos(a),
        },
      );
      return { id, message: `Added milestone “${title}”` };
    },
  },
  {
    id: "projects.milestone.edit",
    title: "Edit milestone",
    keywords: ["project", "milestone", "rename", "reorder", "deadline"],
    icon: Flag,
    args: [
      project,
      milestone,
      { key: "title", label: "Title", kind: "text" },
      start,
      deadline,
      position("Project's Milestones"),
    ],
    returnsDocument: true,
    async invoke(a) {
      const m = await milestoneOf(a);
      const patch: { title?: string; start?: DateStr; deadline?: DateStr } = {};
      if (a.title !== undefined) patch.title = a.title as string;
      if (a.start !== undefined) patch.start = a.start as DateStr;
      if (a.deadline !== undefined) patch.deadline = a.deadline as DateStr;
      await updateMilestone(m, patch);
      const p = pos(a);
      if (p !== undefined) await setMilestonePosition(m.project, m.id, p);
      return {
        id: m.id,
        message: `Updated milestone “${patch.title ?? m.title}”`,
      };
    },
  },
  {
    id: "projects.milestone.reach",
    title: "Reach milestone",
    keywords: ["project", "milestone", "reached", "done", "declare"],
    icon: Flag,
    args: [
      project,
      milestone,
      {
        key: "on",
        label: "Reached on",
        kind: "date",
        hint: "The day it was reached; today when omitted. Declared, never derived from its Tasks.",
      },
      {
        key: "reached",
        label: "Reached",
        kind: "boolean",
        hint: "false un-reaches it. Default true.",
      },
    ],
    returnsDocument: true,
    async invoke(a) {
      const m = await milestoneOf(a);
      if (a.reached === false) {
        if (a.on !== undefined)
          throw new Error("Reached on: a Milestone un-reached has no day");
        await setReached(m, null);
        return {
          id: m.id,
          message: `Milestone “${m.title}” is no longer reached`,
        };
      }
      const on = (a.on as DateStr | undefined) ?? todayStr();
      await setReached(m, on);
      return { id: m.id, message: `Milestone “${m.title}” reached on ${on}` };
    },
  },
  {
    id: "projects.milestone.delete",
    title: "Delete milestone",
    keywords: ["project", "milestone", "remove"],
    icon: Flag,
    args: [project, milestone],
    async invoke(a) {
      const m = await milestoneOf(a);
      await deleteMilestone(m.id);
      return {
        message: `Deleted milestone “${m.title}”; its Tasks stay in the Project`,
      };
    },
  },
  {
    id: "projects.lane.add",
    title: "Add lane",
    keywords: ["project", "lane", "board", "column", "kanban"],
    icon: Columns3,
    args: [
      project,
      { key: "title", label: "Title", kind: "text", required: true },
      position("Board's Lanes"),
    ],
    returnsDocument: true,
    async invoke(a) {
      const title = a.title as string;
      const id = await addLane(a.project as string, title, pos(a));
      return { id, message: `Added lane “${title}”` };
    },
  },
  {
    id: "projects.lane.edit",
    title: "Edit lane",
    keywords: ["project", "lane", "board", "rename", "reorder", "done"],
    icon: Columns3,
    args: [
      project,
      lane,
      { key: "title", label: "Title", kind: "text" },
      position("Board's Lanes"),
      {
        key: "done",
        label: "Done lane",
        kind: "boolean",
        hint: "true makes it the done Lane (unmarking any other); false stops it being one.",
      },
    ],
    returnsDocument: true,
    async invoke(a) {
      const l = await laneOf(a);
      if (a.title !== undefined) await renameLane(l, a.title as string);
      if (a.done === true) await setDoneLane(l.project, l.id);
      else if (a.done === false && l.done) await setDoneLane(l.project, null);
      const p = pos(a);
      if (p !== undefined) await setLanePosition(l.project, l.id, p);
      return {
        id: l.id,
        message: `Updated lane “${(a.title as string | undefined) ?? l.title}”`,
      };
    },
  },
  {
    id: "projects.lane.delete",
    title: "Delete lane",
    keywords: ["project", "lane", "board", "remove"],
    icon: Columns3,
    args: [project, lane],
    async invoke(a) {
      const l = await laneOf(a);
      await deleteLane(l);
      return {
        message: `Deleted lane “${l.title}”; its Tasks go to the first Lane`,
      };
    },
  },
];
