import type { TimedItem } from "./timed";

/** Pure layout helpers for hour-scaled Timed surfaces (the Hub agenda card). */

/** "HH:MM" → fractional hours. */
export function toHours(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h + (m ?? 0) / 60;
}

/** Visible hour window: the configured range, stretched to fit any timed item outside it (never past 24). */
export function hourWindow(items: Pick<TimedItem, "start" | "end">[], startHour: number, endHour: number): { from: number; to: number } {
  let from = Math.max(0, Math.min(startHour, endHour - 1));
  let to = Math.min(24, Math.max(endHour, from + 1));
  for (const it of items) {
    if (!it.start) continue;
    const s = Math.floor(toHours(it.start));
    const e = Math.min(24, Math.max(Math.ceil(toHours(it.end ?? it.start)), s + 1));
    if (s < from) from = s;
    if (e > to) to = e;
  }
  return { from, to };
}

export interface AgendaBlock<T> {
  item: T;
  /** Fractional hours. */
  start: number;
  end: number;
  col: number;
  cols: number;
}

/**
 * Assign overlapping timed items to side-by-side columns. Items are clustered
 * by transitive overlap; every block in a cluster shares the cluster's column
 * count. Zero-length items get a 30-minute minimum. All-day items are skipped.
 */
export function layoutColumns<T extends Pick<TimedItem, "start" | "end">>(items: T[]): AgendaBlock<T>[] {
  const timed = items
    .filter((i) => i.start)
    .map((i) => {
      const s = toHours(i.start!);
      return { item: i, s, e: Math.max(toHours(i.end ?? i.start!), s + 0.5) };
    })
    .sort((a, b) => a.s - b.s || a.e - b.e);
  const out: AgendaBlock<T>[] = [];
  let cluster: typeof timed = [];
  let clusterEnd = -1;
  const flush = () => {
    const ends: number[] = [];
    const placed = cluster.map((x) => {
      let col = ends.findIndex((end) => end <= x.s);
      if (col === -1) {
        col = ends.length;
        ends.push(x.e);
      } else ends[col] = x.e;
      return { item: x.item, start: x.s, end: x.e, col };
    });
    for (const p of placed) out.push({ ...p, cols: ends.length });
    cluster = [];
    clusterEnd = -1;
  };
  for (const x of timed) {
    if (cluster.length && x.s >= clusterEnd) flush();
    cluster.push(x);
    clusterEnd = Math.max(clusterEnd, x.e);
  }
  if (cluster.length) flush();
  return out;
}
