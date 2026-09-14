import { describe, expect, it } from "vitest";
import { elapsedSeconds, formatClock, pauseClock, resumeClock, startClock } from "./talkClock";

/** An arbitrary epoch to count from; the clock only ever reads differences. */
const T0 = 1_700_000_000_000;

describe("talkClock", () => {
  it("starts at zero and counts wall-clock seconds", () => {
    const c = startClock(T0);
    expect(elapsedSeconds(c, T0)).toBe(0);
    expect(elapsedSeconds(c, T0 + 30_000)).toBe(30);
  });

  it("holds its reading while paused, however long the pause lasts", () => {
    const c = pauseClock(startClock(T0), T0 + 30_000);
    expect(elapsedSeconds(c, T0 + 30_000)).toBe(30);
    expect(elapsedSeconds(c, T0 + 600_000)).toBe(30);
  });

  it("banks each stretch, so a pause is not a reset", () => {
    let c = pauseClock(startClock(T0), T0 + 30_000);
    c = resumeClock(c, T0 + 90_000);
    expect(elapsedSeconds(c, T0 + 90_000)).toBe(30);
    expect(elapsedSeconds(c, T0 + 100_000)).toBe(40);
  });

  it("ignores a pause while paused and a resume while running", () => {
    const paused = pauseClock(startClock(T0), T0 + 10_000);
    expect(pauseClock(paused, T0 + 50_000)).toBe(paused);
    const running = startClock(T0);
    expect(resumeClock(running, T0 + 50_000)).toBe(running);
  });

  // Derived from instants, not ticks: a phone that slept through the middle of
  // a talk comes back with the right number rather than however many frames ran.
  it("is right after the tab has been away", () => {
    expect(elapsedSeconds(startClock(T0), T0 + 20 * 60_000)).toBe(1200);
  });

  it("never reads negative if the clock jumps backwards", () => {
    expect(elapsedSeconds(startClock(T0), T0 - 5_000)).toBe(0);
  });

  it("formats minutes, and hours only once there are any", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(754)).toBe("12:34");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});
