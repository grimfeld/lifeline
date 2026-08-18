import { addDays, clampedDate, diffDays, parts, weekdayOf, type DateStr } from "@lifeline/core";
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
 * Pure derivation of everything visible in [start, end] plus the Unassigned
 * pool. Archived tasks never appear. A moved Occurrence shows on its new day
 * (in whatever range that falls) and never on its source day.
 */
export function deriveItems(
  tasks: Task[],
  overrides: OccurrenceOverride[],
  range: { start: DateStr; end: DateStr },
): TaskItem[] {
  const ov = overrideMap(overrides);
  const byTask = new Map(tasks.map((t) => [t.id, t]));
  const items: TaskItem[] = [];
  const seen = new Set<string>();

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
      });
      continue;
    }
    for (const sourceDate of sourceDatesInRange(task, range.start, range.end)) {
      const key = overrideKey(task.id, sourceDate);
      const o = ov.get(key);
      const date = o?.movedTo ?? sourceDate;
      if (date < range.start || date > range.end) continue; // moved out of range
      seen.add(key);
      items.push({
        itemId: key,
        task,
        date,
        sourceDate,
        completedOn: o?.completedOn ?? null,
        recurring: true,
        moved: !!o?.movedTo,
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
    });
  }
  return items.sort((a, b) =>
    (a.date ?? "").localeCompare(b.date ?? "") || a.task.title.localeCompare(b.task.title),
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
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
