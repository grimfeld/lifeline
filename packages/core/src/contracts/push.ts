import { addDays, type DateStr } from "../dates";
import type { TimeStr } from "./timed";

/**
 * The pure heart of Push (ADR 0054): where a Schedulable item's next Time
 * block goes. The write side lives with the other Placement writes in
 * surface.ts; everything here is arithmetic on "HH:MM" and days.
 */

/** The Schedule's quarter-hour grid: a pushed block starts on it. */
export const PUSH_SNAP_MIN = 15;
/** How far ahead Push looks before it gives up. */
export const PUSH_HORIZON_DAYS = 14;
/** How long a Time block with no end is taken to be — the Schedule draws it this long too. */
export const BLOCK_DEFAULT_MIN = 30;

/** Hours someone already holds on a day: an Event, a Time block, a Time blocker band. `end: "24:00"` reaches midnight. */
export interface TakenSpan {
  date: DateStr;
  start: TimeStr;
  end: TimeStr | null;
}

export interface Stretch {
  date: DateStr;
  start: TimeStr;
  end: TimeStr;
}

const DAY_MIN = 24 * 60;

function toMin(t: TimeStr): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function fromMin(n: number): TimeStr {
  const h = Math.floor(n / 60);
  const m = n % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function roundUp(n: number, snap: number): number {
  return Math.ceil(n / snap) * snap;
}

/** A span's end in minutes: an end-less span lasts BLOCK_DEFAULT_MIN; an end at or before the start is read as midnight. */
function endMin(span: Pick<TakenSpan, "start" | "end">): number {
  const s = toMin(span.start);
  if (!span.end) return Math.min(DAY_MIN, s + BLOCK_DEFAULT_MIN);
  const e = toMin(span.end);
  return e > s ? e : DAY_MIN;
}

/** Length of a span in minutes (a block's own length when it is pushed). */
export function spanMinutes(span: Pick<TakenSpan, "start" | "end">): number {
  return endMin(span) - toMin(span.start);
}

/**
 * The first free stretch of `minutes`, in one piece and within one day,
 * starting on the grid at or after `from`, searched `horizonDays` days
 * forward (the day of `from` counts as the first). null when nothing fits.
 */
export function freeStretch(
  taken: TakenSpan[],
  from: { date: DateStr; time: TimeStr },
  minutes: number,
  opts: { horizonDays?: number; snap?: number } = {},
): Stretch | null {
  const horizon = opts.horizonDays ?? PUSH_HORIZON_DAYS;
  const snap = opts.snap ?? PUSH_SNAP_MIN;
  if (minutes <= 0 || minutes > DAY_MIN) return null;

  const byDay = new Map<DateStr, [number, number][]>();
  for (const span of taken) {
    const list = byDay.get(span.date) ?? [];
    list.push([toMin(span.start), endMin(span)]);
    byDay.set(span.date, list);
  }

  for (let d = 0; d < horizon; d++) {
    const date = addDays(from.date, d);
    let cursor = d === 0 ? roundUp(toMin(from.time), snap) : 0;
    const spans = (byDay.get(date) ?? []).sort((a, b) => a[0] - b[0]);
    for (const [s, e] of spans) {
      if (e <= cursor) continue;
      if (s - cursor >= minutes) break;
      cursor = Math.max(cursor, roundUp(e, snap));
    }
    if (DAY_MIN - cursor >= minutes) return { date, start: fromMin(cursor), end: fromMin(cursor + minutes) };
  }
  return null;
}

/** One of the item's own Time blocks, as Push sees it. */
export interface OwnBlock {
  id: string;
  date: DateStr;
  start: TimeStr;
  end: TimeStr | null;
}

export interface PushPlan {
  /** Where the search begins. */
  from: { date: DateStr; time: TimeStr };
  /** The stretch it needs: the Estimate for a new block, the block's own length for a pushed one. */
  minutes: number;
  /** The block being pushed — left out of the taken hours. Absent: Push makes a new block. */
  blockId?: string;
}

/**
 * What Push will do for one item (ADR 0054). With a block ahead (not yet
 * ended), the earliest one moves at its own length — searched from its end
 * when it has not begun, from now when it has. With none, a new block of the
 * Estimate is made, searched from now, or from the item's own day when that
 * day is still ahead.
 */
export function planPush(input: {
  itemDate: DateStr | null;
  blocks: OwnBlock[];
  estimateMin: number;
  today: DateStr;
  now: TimeStr;
}): PushPlan {
  const { today, now } = input;
  const nowFrom = { date: today, time: now };
  const ahead = input.blocks
    .filter((b) => b.date > today || (b.date === today && fromMin(endMin(b)) > now))
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
  const next = ahead[0];
  if (next) {
    const begun = next.date === today && next.start <= now;
    return {
      from: begun ? nowFrom : { date: next.date, time: fromMin(endMin(next)) },
      minutes: spanMinutes(next),
      blockId: next.id,
    };
  }
  const from = input.itemDate && input.itemDate > today ? { date: input.itemDate, time: "00:00" } : nowFrom;
  return { from, minutes: input.estimateMin };
}
