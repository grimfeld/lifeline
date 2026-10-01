import type { DocumentTypeDef } from "@lifeline/core";
import { FolderKanban, Flag, Columns3 } from "lucide-react";
import { releaseTasksOf, clearLane, clearMilestone, tasksOfProject } from "@lifeline/app-tasks/data";
import { PROJECT, PROJECT_LANE, PROJECT_MILESTONE, STAGES, projectHref, stageLabel, type Stage } from "./domain/types";
import { lanesOf, milestonesOf, removeChildren } from "./data/repo";

/**
 * The Projects App's Document types (ADR 0060). The stage and its days are
 * guarded: moving a Project through its stages is the App's operation, which
 * stamps the days the Daylog reports.
 */
export const projectType: DocumentTypeDef = {
  id: PROJECT,
  label: "Projects",
  icon: FolderKanban,
  titleRule: "name",
  body: "optional",
  order: 11,
  linkable: { subtitle: (d) => stageLabel(d.stage as Stage) },
  href: (d) => projectHref(d.id),
  fields: [
    { key: "stage", label: "Stage", kind: "select", options: STAGES, guarded: true, column: true },
    { key: "outcome", label: "Outcome", kind: "text", column: true },
    { key: "start", label: "Start", kind: "date", column: true },
    { key: "deadline", label: "Deadline", kind: "date", column: true },
    { key: "startedOn", label: "Started on", kind: "date", guarded: true },
    { key: "endedOn", label: "Ended on", kind: "date", guarded: true },
    { key: "emoji", label: "Emoji", kind: "text" },
    { key: "color", label: "Colour", kind: "text", hidden: true },
    { key: "rank", label: "Rank", kind: "number", hidden: true },
  ],
  // Deleting a Project releases its Tasks — they stay, as loose Tasks — and
  // takes its Milestones and Lanes, which exist only in its service.
  async onDelete(doc) {
    await releaseTasksOf(doc.id);
    await removeChildren(doc.id);
  },
  // Moved to another Workspace, it takes its Milestones, Lanes and Tasks (ADR 0060).
  async followers(doc) {
    const [ms, ls, ts] = await Promise.all([milestonesOf(doc.id), lanesOf(doc.id), tasksOfProject(doc.id)]);
    return [...ms, ...ls, ...ts].map((d) => d.id);
  },
  builtIn: true,
};

export const milestoneType: DocumentTypeDef = {
  id: PROJECT_MILESTONE,
  label: "Milestones",
  icon: Flag,
  internal: true,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "project", label: "Project", kind: "link", linkType: PROJECT, guarded: true },
    { key: "deadline", label: "Deadline", kind: "date", column: true },
    { key: "start", label: "Start", kind: "date" },
    { key: "reachedOn", label: "Reached on", kind: "date", guarded: true, column: true },
    { key: "rank", label: "Rank", kind: "number", hidden: true },
  ],
  async onDelete(doc) {
    await clearMilestone(doc.id);
  },
  builtIn: true,
};

export const laneType: DocumentTypeDef = {
  id: PROJECT_LANE,
  label: "Lanes",
  icon: Columns3,
  internal: true,
  titleRule: "name",
  body: "none",
  fields: [
    { key: "project", label: "Project", kind: "link", linkType: PROJECT, guarded: true },
    { key: "done", label: "Done lane", kind: "boolean", guarded: true },
    { key: "rank", label: "Rank", kind: "number", hidden: true },
  ],
  async onDelete(doc) {
    await clearLane(doc.id);
  },
  builtIn: true,
};

export const projectTypes: DocumentTypeDef[] = [projectType, milestoneType, laneType];
