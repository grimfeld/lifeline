import { describe, expect, it } from "vitest";
import { blockSeconds, describeBlock, elapsedSeconds, expandBlock, expandWorkout, formatClock, pause, positionAt, resume, skipBack, skipForward, type RunClock } from "./intervals";
import { defaultBlock, emptyMovement, type Block } from "./types";

const tabata = defaultBlock("t", "tabata");
const emom: Block = { ...defaultBlock("e", "emom"), rounds: 3, movements: [emptyMovement("a"), emptyMovement("b")] };
const amrap = defaultBlock("r", "amrap");

describe("expand", () => {
  it("tabata alternates work and rest and ends on work", () => {
    const iv = expandBlock(tabata, 0);
    expect(iv).toHaveLength(15);
    expect(iv[0]).toMatchObject({ kind: "work", seconds: 20, round: 1 });
    expect(iv[1]).toMatchObject({ kind: "rest", seconds: 10, round: 1 });
    expect(iv[14]).toMatchObject({ kind: "work", round: 8 });
    expect(blockSeconds(tabata)).toBe(8 * 30 - 10);
  });
  it("emom alternates movements by round", () => {
    const iv = expandBlock(emom, 0);
    expect(iv.map((i) => i.movement?.exerciseId)).toEqual(["a", "b", "a"]);
    expect(iv.every((i) => i.seconds === 60)).toBe(true);
  });
  it("amrap is one open interval at the cap", () => {
    expect(expandBlock(amrap, 0)).toEqual([expect.objectContaining({ open: true, seconds: 720, kind: "work" })]);
  });
  it("a workout gets a prep in front", () => {
    const iv = expandWorkout({ blocks: [tabata, amrap] });
    expect(iv[0]).toMatchObject({ kind: "prep", seconds: 10 });
    expect(iv).toHaveLength(1 + 15 + 1);
    expect(iv[16].blockIndex).toBe(1);
  });
  it("describes blocks", () => {
    expect(describeBlock(tabata)).toBe("Tabata 8 × 20/10");
    expect(describeBlock(amrap)).toBe("AMRAP 12:00");
    expect(describeBlock(emom)).toBe("EMOM 3");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("position and clock", () => {
  const iv = expandWorkout({ blocks: [tabata] });
  it("locates the interval from elapsed seconds", () => {
    expect(positionAt(iv, 0)).toMatchObject({ index: 0, remaining: 10 });
    expect(positionAt(iv, 10)).toMatchObject({ index: 1, into: 0, remaining: 20 });
    expect(positionAt(iv, 35)).toMatchObject({ index: 2, into: 5, remaining: 5 });
    expect(positionAt(iv, 10_000).done).toBe(true);
  });
  it("derives elapsed from wall time, pauses and skips", () => {
    let c: RunClock = { startedAt: 1_000, pausedAt: null, pausedTotal: 0, skipped: 0 };
    expect(elapsedSeconds(c, 6_000)).toBe(5);
    c = pause(c, 6_000);
    expect(elapsedSeconds(c, 60_000)).toBe(5);
    c = resume(c, 60_000);
    expect(elapsedSeconds(c, 61_000)).toBe(6);
    c = skipForward(c, iv, 61_000); // 6 s in: 4 s of prep left
    expect(elapsedSeconds(c, 61_000)).toBe(10);
    expect(positionAt(iv, elapsedSeconds(c, 61_000)).index).toBe(1);
    c = skipBack(c, iv, 61_000); // at the very start of interval 1 → back to prep start
    expect(elapsedSeconds(c, 61_000)).toBe(0);
  });
  it("skipping past the end is a no-op", () => {
    const c: RunClock = { startedAt: 0, pausedAt: null, pausedTotal: 0, skipped: 10_000 };
    expect(skipForward(c, iv, 0)).toBe(c);
  });
});
