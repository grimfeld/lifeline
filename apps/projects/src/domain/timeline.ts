import { addDays, diffDays, fromParts, parts, type DateStr } from "@lifeline/core";
import { isOpenStage, type Milestone, type Project } from "./types";

/** How many months the Timeline shows at once. */
export const SPAN = 6;

/** The first of the month `shift` months from `d`'s. */
export function monthStart(d: DateStr, shift = 0): DateStr {
  const { y, m } = parts(d);
  const k = y * 12 + (m - 1) + shift;
  return fromParts(Math.floor(k / 12), (k % 12) + 1, 1);
}

/**
 * The Timeline's window from the first of a month (ADR 0060): its last day,
 * and where a day sits across it, in percent — a day outside pinned to an edge.
 */
export function timelineWindow(from: DateStr): { to: DateStr; x: (d: DateStr) => number } {
  const to = addDays(monthStart(from, SPAN), -1);
  const days = diffDays(from, to) + 1;
  return { to, x: (d: DateStr) => (Math.min(Math.max(diffDays(from, d), 0), days) / days) * 100 };
}

/**
 * A Project's bar: from its start (else the day it became Active, else made)
 * to its Deadline (else the day it ended, else the start), the right way
 * round; whether any of it falls in `from`..`to`; late when an open
 * Project's Deadline has passed.
 */
export function barOf(project: Project, from: DateStr, to: DateStr, today: DateStr): { a: DateStr; b: DateStr; visible: boolean; late: boolean } {
  const begin = project.start ?? project.startedOn ?? project.createdAt;
  const end = project.deadline ?? project.endedOn ?? begin;
  const a = begin <= end ? begin : end;
  const b = begin <= end ? end : begin;
  return { a, b, visible: b >= from && a <= to, late: !!project.deadline && project.deadline < today && isOpenStage(project.stage) };
}

/** The Project's Milestones with a Deadline inside `from`..`to`: the flags along its bar. */
export function flagsOf(milestones: Milestone[], projectId: string, from: DateStr, to: DateStr): Milestone[] {
  return milestones.filter((m) => m.project === projectId && m.deadline && m.deadline >= from && m.deadline <= to);
}
