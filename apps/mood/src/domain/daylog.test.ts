import { describe, expect, it } from "vitest";
import { daylogMood } from "./daylog";
import type { Mood } from "./types";

const mood = (title: string, level: unknown): Mood => ({ id: "m" + title, type: "mood", title, updatedAt: "", deleted: 0, tags: [], folder: "", level } as unknown as Mood);

describe("daylogMood", () => {
  it("reports the day's mood, untimed", () => {
    const [item] = daylogMood([mood("2026-09-01", 5)], "2026-09-01");
    expect(item?.kind).toBe("Felt");
    expect(item?.title).toBe("😄 Great");
    expect(item?.time).toBeNull();
  });
  it("says nothing about a day with no Mood", () => {
    expect(daylogMood([mood("2026-09-01", 5)], "2026-09-02")).toEqual([]);
  });
  it("says nothing when the stored level is junk", () => {
    expect(daylogMood([mood("2026-09-01", 42)], "2026-09-01")).toEqual([]);
  });
});
