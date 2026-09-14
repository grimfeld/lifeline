/**
 * A stopwatch for reading a Document aloud (a talk, a sermon). Elapsed time is
 * derived from wall-clock instants rather than accumulated ticks, the way the
 * workout timer does it (ADR 0030): a backgrounded tab, a locked phone or a
 * dropped frame all resume at the right number instead of drifting behind.
 */
export interface TalkClock {
  /** When the current run began (ms since epoch). */
  startedAt: number;
  /** Seconds banked by earlier runs, before the latest pause. */
  banked: number;
  /** When it was paused (ms since epoch), or null while running. */
  pausedAt: number | null;
}

export function startClock(now: number): TalkClock {
  return { startedAt: now, banked: 0, pausedAt: null };
}

/** Seconds on the clock: what earlier runs banked, plus the run in progress. */
export function elapsedSeconds(clock: TalkClock, now: number): number {
  const until = clock.pausedAt ?? now;
  return clock.banked + Math.max(0, until - clock.startedAt) / 1000;
}

/**
 * Bank the running stretch and stop. Pausing twice changes nothing.
 *
 * `startedAt` moves up to the pause as well: the stretch it measured is now in
 * `banked`, and leaving it behind would have the paused clock count it a second
 * time on every read.
 */
export function pauseClock(clock: TalkClock, now: number): TalkClock {
  if (clock.pausedAt !== null) return clock;
  return { startedAt: now, banked: elapsedSeconds(clock, now), pausedAt: now };
}

/** Start a new stretch from the banked total. Resuming a running clock changes nothing. */
export function resumeClock(clock: TalkClock, now: number): TalkClock {
  if (clock.pausedAt === null) return clock;
  return { startedAt: now, banked: clock.banked, pausedAt: null };
}

/** "0:00", "12:34", "1:02:05" — minutes until an hour is reached, then hours. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}
