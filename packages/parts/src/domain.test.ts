import { describe, expect, it } from "vitest";
import {
  averageRating,
  daySummary,
  isCaughtUp,
  isRead,
  nextPart,
  partIsEmpty,
  partName,
  progressOf,
  raisedSize,
  runComplete,
  runOf,
  type Group,
  type Part,
  type PartsHolder,
  type PartsMedium,
} from "./domain";

const CHAPTERS: PartsMedium = { numbering: "runOn", part: "Chapter", parts: "chapters", group: "Volume", groups: "volumes", verb: "Read" };
const EPISODES: PartsMedium = { numbering: "restart", part: "Episode", parts: "episodes", group: "Season", groups: "seasons", verb: "Watched", abbrev: (g, n) => `S${g}E${n}` };

const work = (w: Partial<PartsHolder> = {}): PartsHolder => ({ id: "w", type: "manga", title: "One Piece", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, size: 0, ...w });
const part = (p: Partial<Part>): Part => ({ id: `p${p.group ?? 0}-${p.number}`, type: "part", title: "", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, work: "w", group: 0, number: 1, name: "", readOn: "", liked: false, rating: 0, ...p });
const group = (g: Partial<Group>): Group => ({ id: `g${g.number}`, type: "group", title: "", tags: [], folder: "", createdAt: "", updatedAt: "", deleted: 0, work: "w", number: 1, name: "", size: 0, firstPart: 0, liked: false, rating: 0, ...g });

describe("running-on numbering (manga)", () => {
  it("catching up reads everything up to N with no day, and the next is N+1", () => {
    const input = { medium: CHAPTERS, work: work({ caughtUpPart: 1045 }), parts: [], groups: [] };
    expect(progressOf(input)).toEqual({ read: 1045, total: 0 });
    expect(nextPart(input)).toEqual({ group: 0, number: 1046 });
    expect(isCaughtUp({ group: 0, number: 12 }, { group: 0, number: 1045 }, undefined)).toBe(true);
  });

  it("a Part read on its own day above the catch-up counts, and a gap stays next", () => {
    const input = { medium: CHAPTERS, work: work({ size: 10, caughtUpPart: 3 }), parts: [part({ number: 5, readOn: "2026-10-18" })], groups: [] };
    expect(progressOf(input)).toEqual({ read: 4, total: 10 });
    expect(nextPart(input)).toEqual({ group: 0, number: 4 });
  });

  it("a known end that is all read has no next and is complete", () => {
    const input = { medium: CHAPTERS, work: work({ size: 2 }), parts: [part({ number: 1, readOn: "d" }), part({ number: 2, readOn: "d" })], groups: [] };
    expect(nextPart(input)).toBeNull();
    expect(runComplete(input)).toBe(true);
  });

  it("an ongoing run is never complete", () => {
    const input = { medium: CHAPTERS, work: work({ caughtUpPart: 5 }), parts: [], groups: [] };
    expect(runComplete(input)).toBe(false);
  });

  it("Volumes split the run where each begins; the Parts before the first stand alone", () => {
    const sections = runOf({ medium: CHAPTERS, work: work({ size: 30 }), parts: [], groups: [group({ number: 2, firstPart: 10 }), group({ number: 3, firstPart: 20 })] });
    expect(sections.map((s) => [s.group, s.first, s.last])).toEqual([[0, 1, 9], [2, 10, 19], [3, 20, 30]]);
  });

  it("reading past a known end raises it; a blank size stays blank", () => {
    expect(raisedSize({ medium: CHAPTERS, work: work({ size: 10 }), parts: [], groups: [] }, { group: 0, number: 12 })).toBe(12);
    expect(raisedSize({ medium: CHAPTERS, work: work({ size: 0 }), parts: [], groups: [] }, { group: 0, number: 12 })).toBeNull();
  });
});

describe("restarting numbering (series)", () => {
  it("with no Seasons, it is a plain run", () => {
    const input = { medium: EPISODES, work: work({ size: 3 }), parts: [part({ number: 1, readOn: "d" })], groups: [] };
    expect(nextPart(input)).toEqual({ group: 0, number: 2 });
  });

  it("caught up to S3E4: every earlier Season is read, then S3E5 is next", () => {
    const groups = [group({ number: 1, size: 10 }), group({ number: 2, size: 8 }), group({ number: 3, size: 8 })];
    const input = { medium: EPISODES, work: work({ size: 26, caughtUpGroup: 3, caughtUpPart: 4 }), parts: [], groups };
    expect(progressOf(input)).toEqual({ read: 22, total: 26 });
    expect(nextPart(input)).toEqual({ group: 3, number: 5 });
  });

  it("a finished Season of unknown length keeps going; a known one moves to the next Season when the series is ongoing", () => {
    const open = { medium: EPISODES, work: work(), parts: [part({ group: 1, number: 1, readOn: "d" })], groups: [] };
    expect(nextPart(open)).toEqual({ group: 1, number: 2 });
    const known = { medium: EPISODES, work: work(), parts: [part({ group: 1, number: 1, readOn: "d" })], groups: [group({ number: 1, size: 1 })] };
    expect(nextPart(known)).toEqual({ group: 2, number: 1 });
  });

  it("reading past a Season raises the series' total by the overshoot", () => {
    const input = { medium: EPISODES, work: work({ size: 18 }), parts: [], groups: [group({ number: 1, size: 10 }), group({ number: 2, size: 8 })] };
    expect(raisedSize(input, { group: 2, number: 9 })).toBe(19);
    expect(raisedSize(input, { group: 3, number: 1 })).toBe(19);
  });

  it("names positions the medium's way", () => {
    expect(partName(EPISODES, { group: 2, number: 4 })).toBe("S2E4");
    expect(partName(CHAPTERS, { group: 0, number: 1046 })).toBe("Chapter 1046");
  });
});

describe("the rest", () => {
  it("read is the catch-up or a day of its own", () => {
    expect(isRead({ group: 0, number: 3 }, { group: 0, number: 0 }, undefined)).toBe(false);
    expect(isRead({ group: 0, number: 3 }, { group: 0, number: 0 }, part({ number: 3, readOn: "d" }))).toBe(true);
  });

  it("a Part with nothing to say is empty", () => {
    expect(partIsEmpty(part({}))).toBe(true);
    expect(partIsEmpty(part({ body: "Great fight" }))).toBe(false);
    expect(partIsEmpty(part({ rating: 3 }))).toBe(false);
  });

  it("the average is of rated items only", () => {
    expect(averageRating([{ liked: false, rating: 4 }, { liked: true, rating: 0 }, { liked: false, rating: 2 }])).toBe(3);
    expect(averageRating([])).toBe(0);
  });

  it("summarises a day's reading", () => {
    expect(daySummary(CHAPTERS, [{ group: 0, number: 1046 }])).toBe("Chapter 1046");
    expect(daySummary(CHAPTERS, [{ group: 0, number: 1047 }, { group: 0, number: 1046 }])).toBe("Chapters 1046–1047");
    expect(daySummary(EPISODES, [{ group: 2, number: 4 }, { group: 2, number: 5 }, { group: 2, number: 6 }])).toBe("S2E4–6");
    expect(daySummary(CHAPTERS, [{ group: 0, number: 1 }, { group: 0, number: 5 }])).toBe("2 chapters");
  });
});
