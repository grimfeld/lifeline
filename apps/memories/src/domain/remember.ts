import { diffDays, parts, pickForDay, type DateStr } from "@lifeline/core";
import type { Memory } from "./types";

/**
 * Remember (CONTEXT.md): what today's Day offers from the past. The pool is the
 * Memories dated before today; the ones from today's month and day in an earlier
 * year, when there are any. The pick is a function of the date and the pool, so
 * every device agrees; `step` is Another's offset in the pool's id order, held by
 * the caller and never stored. `another` says there is a different one to step to.
 */
export function remember(memories: readonly Memory[], today: DateStr, step: number): { memory: Memory; another: boolean } | undefined {
  const past = memories.filter((m) => typeof m.date === "string" && m.date < today);
  const { m: month, day } = parts(today);
  const onThisDay = past.filter((m) => {
    const p = parts(m.date);
    return p.m === month && p.day === day;
  });
  const pool = (onThisDay.length ? onThisDay : past).slice().sort((a, b) => a.id.localeCompare(b.id));
  const first = pickForDay(pool, today);
  if (!first) return undefined;
  const at = (pool.indexOf(first) + step) % pool.length;
  return { memory: pool[at]!, another: pool.length > 1 };
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"} ago`;

/** How long before `today` a past date is, in its largest whole unit: "3 years ago", "2 weeks ago". */
export function agoLabel(date: DateStr, today: DateStr): string {
  const days = diffDays(date, today);
  if (days <= 1) return "Yesterday";
  const a = parts(date);
  const b = parts(today);
  let months = (b.y - a.y) * 12 + (b.m - a.m) - (b.day < a.day ? 1 : 0);
  if (months < 0) months = 0;
  if (months >= 12) return plural(Math.floor(months / 12), "year");
  if (months >= 1) return plural(months, "month");
  if (days >= 7) return plural(Math.floor(days / 7), "week");
  return plural(days, "day");
}
