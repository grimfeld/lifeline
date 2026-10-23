import { BLOCK_DEFAULT_MIN, toHours, type DateStr, type PoolItem, type SurfaceItem, type SurfaceTimedItem, type TimedTemplate } from "@lifeline/core";
import { SNAP_MIN, snap, toClock } from "./hours";

/**
 * The Schedule's grid maths (ADR 0015): where an item sits on the hours, where
 * a drag or a resize lands, and which items go on which day. Pure, so the
 * Schedule's components only draw and wire events.
 */

/** One hour of the grid, in pixels. */
export const HOUR_PX = 56;
/** How long a Time block lasts when nothing says otherwise. */
export const DEFAULT_MIN = BLOCK_DEFAULT_MIN;
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type WorkItem = (SurfaceItem | (PoolItem & { displayDate?: undefined; placementId?: undefined; start?: undefined; end?: undefined })) & { color?: string };
export type Entry = { kind: "block"; item: SurfaceItem; start: string; end: string } | { kind: "timed"; item: SurfaceTimedItem; start: string; end: string };
/** Where a lifted item will land: drawn in the grid while the drag hovers a day. */
export type Ghost = { date: DateStr; startH: number; lenH: number };
/** A Time blocker's band on one day (ADR 0027): painted behind everything. A weekly rule's band is fixed; a one-off's (ADR 0029) drags and resizes. */
export type Band = { key: string; title: string; start: string; end: string; color?: string; fixed: boolean; item: SurfaceTimedItem };
/** What a drag carries: work, a timed item, or a template. */
export type Lifted = { item?: WorkItem; timed?: SurfaceTimedItem; template?: TimedTemplate };

/** The hour gutter's label: "1:00 PM" with room, bare "1 PM" on a phone. */
export function hourLabel(hour: number, compact: boolean): string {
  return new Date(Date.UTC(2000, 0, 1, hour, 0)).toLocaleTimeString(undefined, {
    hour: "numeric",
    ...(compact ? {} : { minute: "2-digit" }),
    timeZone: "UTC",
  });
}

/** A day's short name, Monday first: "Mon".."Sun". */
export function weekdayName(d: DateStr): string {
  return DAY_NAMES[(new Date(d + "T12:00:00").getDay() + 6) % 7];
}

/** Hours from `start` to `end`, at least one grid step; `fallbackMin` when there is no end. */
export function durationOf(start: string, end: string | null | undefined, fallbackMin = DEFAULT_MIN): number {
  return end ? Math.max(SNAP_MIN / 60, toHours(end) - toHours(start)) : fallbackMin / 60;
}

/** `start` plus `h` hours, as a clock time no later than 24:00. */
export function addHours(start: string, h: number): string {
  return toClock(Math.min(24, toHours(start) + h));
}

/** A bottom edge dragged `dy` pixels from `startEnd`: the new end, snapped, at least one grid step after `startH`. */
export function resizedEnd(startH: number, startEnd: number, dy: number): number {
  return Math.max(startH + SNAP_MIN / 60, snap(startEnd + dy / HOUR_PX));
}

/** The hour a tap or double-click `offsetY` pixels into hour row `i` adds at: snapped to the quarter it falls in, kept before `to`. */
export function slotHours(from: number, to: number, i: number, offsetY: number): number {
  return Math.min(to - SNAP_MIN / 60, snap(from + i + offsetY / HOUR_PX - SNAP_MIN / 120));
}

/** The hour a drag lands on when the lifted thing's top is `top` pixels below the column's top: snapped, inside `from`..`to`. */
export function landingHours(top: number, from: number, to: number): number {
  return Math.max(from, Math.min(to - SNAP_MIN / 60, snap(from + top / HOUR_PX)));
}

/** How long the lifted thing lasts, in hours; null when it lands as all-day. */
export function lengthOf(d: Lifted): number | null {
  if (d.template) return d.template.durationMin === null ? null : d.template.durationMin / 60;
  if (d.item) return d.item.start ? durationOf(d.item.start, d.item.end) : DEFAULT_MIN / 60;
  if (d.timed) return d.timed.start ? durationOf(d.timed.start, d.timed.end, 60) : 1;
  return null;
}

/**
 * Every timed thing on the hours, by the day it is drawn on: Time blocks on
 * their display day (lasting the default when end-less), Timed items on
 * their own (an hour when end-less). Only items with a start belong here.
 */
export function entriesByDay(blocks: SurfaceItem[], timed: SurfaceTimedItem[]): Map<DateStr, Entry[]> {
  const out = new Map<DateStr, Entry[]>();
  const add = (d: DateStr, e: Entry) => {
    const list = out.get(d);
    if (list) list.push(e);
    else out.set(d, [e]);
  };
  for (const b of blocks) add(b.displayDate, { kind: "block", item: b, start: b.start!, end: b.end ?? addHours(b.start!, DEFAULT_MIN / 60) });
  for (const t of timed) add(t.date, { kind: "timed", item: t, start: t.start!, end: t.end ?? addHours(t.start!, 1) });
  return out;
}

/** The Time blocker bands on day `d`: an end-less one runs to midnight. */
export function bandsOn(bandItems: SurfaceTimedItem[], d: DateStr): Band[] {
  return bandItems
    .filter((b) => b.date === d)
    .map((b) => ({ key: b.key, title: b.title, start: b.start!, end: b.end ?? "24:00", color: b.color, fixed: !!b.fixed, item: b }));
}

/** Day `d`'s untimed row: work without a time, and all-day timed items. */
export function stripOn(items: SurfaceItem[], timed: SurfaceTimedItem[], d: DateStr): { work: WorkItem[]; allDay: SurfaceTimedItem[] } {
  return {
    work: items.filter((i) => i.displayDate === d && !i.start) as WorkItem[],
    allDay: timed.filter((t) => t.date === d && !t.start),
  };
}

/** A template's length on its chip: "all day", "45m", "1.5h". */
export function templateLength(durationMin: number | null): string {
  return durationMin === null ? "all day" : durationMin >= 60 ? `${Math.round((durationMin / 60) * 10) / 10}h` : `${durationMin}m`;
}
