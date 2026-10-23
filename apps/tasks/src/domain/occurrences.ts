import {
  addDays,
  clampedDate,
  diffDays,
  fromParts,
  parts,
  todayStr,
  weekdayOf,
  type DateStr,
} from "@lifeline/core";
import type { OccurrenceOverride, Recurrence, Task } from "./types";

/**
 * Identity of a Task's appearance on a day, stable across moves.
 * One-time Task: its record id. Occurrence: `${taskId}|${sourceDate}`.
 * This is also the itemId handed to Core's Schedulable contract.
 */
export type ItemId = string;

export function occurrenceItemId(taskId: string, sourceDate: DateStr): ItemId {
  return `${taskId}|${sourceDate}`;
}

export function parseItemId(itemId: ItemId): { taskId: string; sourceDate: DateStr | null } {
  const i = itemId.indexOf("|");
  if (i === -1) return { taskId: itemId, sourceDate: null };
  return { taskId: itemId.slice(0, i), sourceDate: itemId.slice(i + 1) };
}

/** A Task materialised on a day (or in the Unassigned pool). Never stored. */
export interface TaskItem {
  itemId: ItemId;
  task: Task;
  /** Day it is shown on. null = Unassigned (one-time only). */
  date: DateStr | null;
  /** Natural day; differs from `date` when a recurring Occurrence was moved. */
  sourceDate: DateStr | null;
  completedOn: DateStr | null;
  recurring: boolean;
  moved: boolean;
  /**
   * A missed Occurrence the rule has already moved past (ADR 0036): it keeps
   * its day as record but no longer reads as overdue — the new Occurrence
   * carries that. Always false for a one-time Task, which stays overdue.
   */
  lapsed: boolean;
}

export function overrideKey(taskId: string, sourceDate: DateStr): string {
  return occurrenceItemId(taskId, sourceDate);
}

export function overrideMap(overrides: OccurrenceOverride[]): Map<string, OccurrenceOverride> {
  const m = new Map<string, OccurrenceOverride>();
  for (const o of overrides) m.set(overrideKey(o.taskId, o.sourceDate), o);
  return m;
}

/** Days in [start, end] on which a recurring task naturally occurs (never before its creation day). */
export function sourceDatesInRange(task: Task, start: DateStr, end: DateStr): DateStr[] {
  if (!task.recurrence) return [];
  const from = start > task.createdAt ? start : task.createdAt;
  if (from > end) return [];
  const r = task.recurrence;
  if (r.kind === "weekly") {
    const want = new Set(r.weekdays);
    const out: DateStr[] = [];
    const n = diffDays(from, end);
    for (let i = 0; i <= n; i++) {
      const d = addDays(from, i);
      if (want.has(weekdayOf(d))) out.push(d);
    }
    return out;
  }
  // monthly / yearly: enumerate the candidate dates month by month, clamped to month length.
  const out = new Set<DateStr>();
  const a = parts(from);
  const b = parts(end);
  for (let y = a.y; y <= b.y; y++) {
    for (let m = y === a.y ? a.m : 1; m <= (y === b.y ? b.m : 12); m++) {
      const days = r.kind === "monthly" ? r.days : r.dates.filter((d) => d.month === m).map((d) => d.day);
      for (const day of days) {
        const d = clampedDate(y, m, day);
        if (d >= from && d <= end) out.add(d);
      }
    }
  }
  return Array.from(out).sort();
}

/**
 * How far back the rule is guaranteed to have produced an Occurrence: a week
 * for weekly, the previous month for monthly, the previous year for yearly.
 * Enough to find the previous Occurrence without walking all of history.
 */
function lookbackStart(r: Recurrence, on: DateStr): DateStr {
  if (r.kind === "weekly") return addDays(on, -6);
  const { y, m } = parts(on);
  if (r.kind === "monthly") return m === 1 ? fromParts(y - 1, 12, 1) : fromParts(y, m - 1, 1);
  return fromParts(y - 1, 1, 1);
}

/**
 * The Occurrence a recurring Task is *on* as of `on`: the latest source day
 * its rule has produced, today included. null before the first one (or for a
 * one-time Task). Everything the rule produced earlier has been superseded.
 */
export function currentSourceDate(task: Task, on: DateStr): DateStr | null {
  if (!task.recurrence) return null;
  const dates = sourceDatesInRange(task, lookbackStart(task.recurrence, on), on);
  return dates.at(-1) ?? null;
}

/**
 * Pure derivation of everything visible in [start, end] plus the Unassigned
 * pool. Archived tasks never appear. A moved Occurrence shows on its new day
 * (in whatever range that falls) and never on its source day. `today` decides
 * which Occurrences have lapsed (ADR 0036); it is a parameter so the
 * derivation stays pure and testable.
 */
export function deriveItems(
  tasks: Task[],
  overrides: OccurrenceOverride[],
  range: { start: DateStr; end: DateStr },
  today: DateStr = todayStr(),
): TaskItem[] {
  const ov = overrideMap(overrides);
  const byTask = new Map(tasks.map((t) => [t.id, t]));
  const items: TaskItem[] = [];
  const seen = new Set<string>();
  // One walk back per recurring Task, however many of its Occurrences are shown.
  const current = new Map<string, DateStr | null>();
  const currentOf = (task: Task): DateStr | null => {
    if (!current.has(task.id)) current.set(task.id, currentSourceDate(task, today));
    return current.get(task.id) ?? null;
  };
  /** Missed, still open, and the rule has since produced a newer Occurrence. */
  const hasLapsed = (task: Task, o: { date: DateStr; sourceDate: DateStr; completedOn: DateStr | null }): boolean => {
    if (o.completedOn || o.date >= today) return false;
    const cur = currentOf(task);
    return cur !== null && o.sourceDate < cur;
  };

  for (const task of tasks) {
    if (task.status !== "active") continue;
    if (!task.recurrence) {
      if (task.date !== null && (task.date < range.start || task.date > range.end)) continue;
      items.push({
        itemId: task.id,
        task,
        date: task.date,
        sourceDate: task.date,
        completedOn: task.completedOn,
        recurring: false,
        moved: false,
        lapsed: false,
      });
      continue;
    }
    for (const sourceDate of sourceDatesInRange(task, range.start, range.end)) {
      const key = overrideKey(task.id, sourceDate);
      const o = ov.get(key);
      const date = o?.movedTo ?? sourceDate;
      if (date < range.start || date > range.end) continue; // moved out of range
      seen.add(key);
      const completedOn = o?.completedOn ?? null;
      items.push({
        itemId: key,
        task,
        date,
        sourceDate,
        completedOn,
        recurring: true,
        moved: !!o?.movedTo,
        lapsed: hasLapsed(task, { date, sourceDate, completedOn }),
      });
    }
  }
  // Occurrences moved into range from a source day outside it.
  for (const o of overrides) {
    if (!o.movedTo || o.movedTo < range.start || o.movedTo > range.end) continue;
    const key = overrideKey(o.taskId, o.sourceDate);
    if (seen.has(key)) continue;
    const task = byTask.get(o.taskId);
    if (!task || task.status !== "active" || !task.recurrence) continue;
    // Guard against stale overrides whose source day no longer matches the rule.
    if (o.sourceDate < task.createdAt) continue;
    if (!sourceDatesInRange(task, o.sourceDate, o.sourceDate).includes(o.sourceDate)) continue;
    items.push({
      itemId: key,
      task,
      date: o.movedTo,
      sourceDate: o.sourceDate,
      completedOn: o.completedOn,
      recurring: true,
      moved: true,
      lapsed: hasLapsed(task, { date: o.movedTo, sourceDate: o.sourceDate, completedOn: o.completedOn }),
    });
  }
  return items.sort((a, b) =>
    (a.date ?? "").localeCompare(b.date ?? "") || a.task.title.localeCompare(b.task.title),
  );
}

/**
 * What is on `today`: everything placed on today (done or not), plus every
 * open overdue item — however old. No lookback window: a one-time Task stays
 * overdue until done or moved (ADR 0004), and a recurring Task's current
 * Occurrence carries its overdue standing however long ago the rule produced
 * it (ADR 0036). The recurring range therefore starts at the earliest current
 * source day (or open Occurrence moved into the past), which bounds the walk.
 */
export function dueItems(tasks: Task[], overrides: OccurrenceOverride[], today: DateStr = todayStr()): TaskItem[] {
  const oneTime = tasks.filter((t) => !t.recurrence);
  const recurring = tasks.filter((t) => t.recurrence);
  let start = today;
  for (const t of recurring) {
    if (t.status !== "active") continue;
    const cur = currentSourceDate(t, today);
    if (cur !== null && cur < start) start = cur;
  }
  for (const o of overrides) {
    if (o.movedTo && !o.completedOn && o.movedTo < start) start = o.movedTo;
  }
  return [
    ...deriveItems(oneTime, [], { start: "0000-01-01", end: today }, today),
    ...deriveItems(recurring, overrides, { start, end: today }, today),
  ]
    .filter((i) => i.date !== null && !i.lapsed && (i.date === today || !i.completedOn))
    .sort((a, b) => a.date!.localeCompare(b.date!) || a.task.title.localeCompare(b.task.title));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? "th");
}

export function describeRecurrence(r: Recurrence): string {
  if (r.kind === "monthly") {
    const days = [...r.days].sort((a, b) => a - b).map(ordinal);
    return `Monthly on the ${days.join(", ")}`;
  }
  if (r.kind === "yearly") {
    const dates = [...r.dates].sort((a, b) => a.month - b.month || a.day - b.day).map((d) => `${MONTHS[d.month - 1]} ${d.day}`);
    return `Yearly on ${dates.join(", ")}`;
  }
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  // Show Monday-first
  const order = [1, 2, 3, 4, 5, 6, 0];
  const has = new Set<number>(r.weekdays);
  const days = order.filter((d) => has.has(d)).map((d) => names[d]);
  if (days.length === 7) return "Every day";
  return `Weekly on ${days.join(", ")}`;
}
