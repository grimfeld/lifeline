import { MODE_LABEL, type Block, type Movement, type Workout } from "./types";

/**
 * The timer's whole vocabulary (ADR 0030): a Workout expands into a flat
 * list of intervals, and the running timer derives where it is from the
 * elapsed time alone — never from accumulated ticks, so a backgrounded tab
 * resumes exactly.
 */
export interface Interval {
  blockIndex: number;
  blockId: string;
  mode: Block["mode"];
  /** 1-based round inside the Block; 0 for the get-ready prep. */
  round: number;
  rounds: number;
  kind: "prep" | "work" | "rest";
  seconds: number;
  /** AMRAP / For Time: one long interval the user counts rounds in or stops early. */
  open: boolean;
  label: string;
  movement?: Movement;
}

export const PREP_SECONDS = 10;

/** Seconds a Block takes end to end (open Blocks: their cap). */
export function blockSeconds(b: Block): number {
  switch (b.mode) {
    case "emom":
      return b.rounds * b.every;
    case "amrap":
    case "fortime":
      return b.cap;
    case "tabata":
    case "intervals":
      return b.rounds * (b.work + b.rest) - (b.rounds > 0 ? b.rest : 0);
  }
}

export function workoutSeconds(w: Pick<Workout, "blocks">): number {
  return (w.blocks ?? []).reduce((n, b) => n + blockSeconds(b), 0);
}

/** "12:00", "1:05:00". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

/** "EMOM 10 · every 1:00", "AMRAP 12:00", "Tabata 8 × 20/10", "For Time · cap 20:00", "5 × 1:00/0:30". */
export function describeBlock(b: Block): string {
  switch (b.mode) {
    case "emom":
      return `EMOM ${b.rounds}${b.every !== 60 ? ` · every ${formatClock(b.every)}` : ""}`;
    case "amrap":
      return `AMRAP ${formatClock(b.cap)}`;
    case "tabata":
      return `Tabata ${b.rounds} × ${b.work}/${b.rest}`;
    case "fortime":
      return `For Time · cap ${formatClock(b.cap)}`;
    case "intervals":
      return `${b.rounds} × ${formatClock(b.work)}/${formatClock(b.rest)}`;
  }
}

/** "3 blocks · 32:00". A Workout made outside the App (a Base's new row) has no blocks yet. */
export function describeWorkout(w: Pick<Workout, "blocks">): string {
  const n = w.blocks?.length ?? 0;
  return `${n} block${n === 1 ? "" : "s"} · ${formatClock(workoutSeconds(w))}`;
}

function movementFor(b: Block, round: number): Movement | undefined {
  if (b.movements.length === 0) return undefined;
  return b.movements[(round - 1) % b.movements.length];
}

/**
 * Expand one Block into its intervals. EMOM alternates Movements by round;
 * Tabata/Intervals take one per work interval; AMRAP and For Time are a
 * single open interval carrying no Movement (the user cycles through them).
 */
export function expandBlock(b: Block, blockIndex: number): Interval[] {
  const title = b.label || MODE_LABEL[b.mode];
  const base = { blockIndex, blockId: b.id, mode: b.mode, rounds: b.rounds, open: false, label: title };
  switch (b.mode) {
    case "emom":
      return Array.from({ length: b.rounds }, (_, i) => ({ ...base, round: i + 1, kind: "work" as const, seconds: b.every, movement: movementFor(b, i + 1) }));
    case "amrap":
    case "fortime":
      return [{ ...base, round: 1, rounds: 1, kind: "work", seconds: b.cap, open: true }];
    case "tabata":
    case "intervals": {
      const out: Interval[] = [];
      for (let r = 1; r <= b.rounds; r++) {
        out.push({ ...base, round: r, kind: "work", seconds: b.work, movement: movementFor(b, r) });
        if (r < b.rounds && b.rest > 0) out.push({ ...base, round: r, kind: "rest", seconds: b.rest });
      }
      return out;
    }
  }
}

/** The whole Workout as intervals, with a get-ready prep in front. */
export function expandWorkout(w: Pick<Workout, "blocks">, prepSeconds = PREP_SECONDS): Interval[] {
  const out: Interval[] = [];
  if (prepSeconds > 0 && w.blocks.length > 0) {
    const first = w.blocks[0];
    out.push({ blockIndex: 0, blockId: first.id, mode: first.mode, round: 0, rounds: first.rounds, kind: "prep", seconds: prepSeconds, open: false, label: "Get ready" });
  }
  w.blocks.forEach((b, i) => out.push(...expandBlock(b, i)));
  return out;
}

/** Where the timer is after `elapsed` seconds into the sequence. */
export interface Position {
  index: number;
  /** Seconds into the current interval. */
  into: number;
  /** Seconds left in it (open intervals count down to their cap too). */
  remaining: number;
  done: boolean;
}

export function positionAt(intervals: Interval[], elapsed: number): Position {
  let t = Math.max(0, elapsed);
  for (let i = 0; i < intervals.length; i++) {
    const s = intervals[i].seconds;
    if (t < s) return { index: i, into: t, remaining: s - t, done: false };
    t -= s;
  }
  const last = Math.max(0, intervals.length - 1);
  return { index: last, into: intervals[last]?.seconds ?? 0, remaining: 0, done: true };
}

/** Seconds from the start of the sequence to the start of interval `index`. */
export function offsetOf(intervals: Interval[], index: number): number {
  let t = 0;
  for (let i = 0; i < index && i < intervals.length; i++) t += intervals[i].seconds;
  return t;
}

/**
 * The run's clock: elapsed = wall time since start, minus time spent paused,
 * plus time skipped forward. Everything the timer shows derives from this.
 */
export interface RunClock {
  startedAt: number;
  pausedAt: number | null;
  pausedTotal: number;
  skipped: number;
}

export function elapsedSeconds(c: RunClock, now: number): number {
  const wall = (c.pausedAt ?? now) - c.startedAt - c.pausedTotal;
  return Math.max(0, wall / 1000 + c.skipped);
}

export function pause(c: RunClock, now: number): RunClock {
  return c.pausedAt === null ? { ...c, pausedAt: now } : c;
}

export function resume(c: RunClock, now: number): RunClock {
  return c.pausedAt === null ? c : { ...c, pausedAt: null, pausedTotal: c.pausedTotal + (now - c.pausedAt) };
}

/** Jump to the start of the next interval (or finish). */
export function skipForward(c: RunClock, intervals: Interval[], now: number): RunClock {
  const pos = positionAt(intervals, elapsedSeconds(c, now));
  if (pos.done) return c;
  return { ...c, skipped: c.skipped + pos.remaining };
}

/** Jump back to the start of the current interval, or of the previous one when already at its start. */
export function skipBack(c: RunClock, intervals: Interval[], now: number): RunClock {
  const el = elapsedSeconds(c, now);
  const pos = positionAt(intervals, el);
  const startOfCurrent = offsetOf(intervals, pos.index);
  const target = pos.into > 1.5 || pos.index === 0 ? startOfCurrent : offsetOf(intervals, pos.index - 1);
  return { ...c, skipped: c.skipped - (el - target) };
}
