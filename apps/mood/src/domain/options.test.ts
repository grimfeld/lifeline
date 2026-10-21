import { describe, expect, it } from "vitest";
import { readInlineLine, type InlineCommand } from "@lifeline/core";
import { moodOptions } from "./types";

/** The palette's `#` reads a mood by its synonyms too (story 28), in English and in French. */
const setMood: InlineCommand = {
  appId: "mood",
  id: "mood.set",
  title: "Set mood…",
  args: [{ key: "mood", label: "Mood", kind: "select", required: true, options: moodOptions() }],
  invoke: async () => ({ message: "ok" }),
};
const moodOf = (word: string) => readInlineLine({ line: `!set-mood #${word}`, commands: [setMood] }).args.mood;

describe("mood options", () => {
  it("are read by their own name", () => {
    expect(moodOf("great")).toBe("great");
  });

  it("are read by an English or a French synonym", () => {
    expect(moodOf("awful")).toBe("rough");
    expect(moodOf("bof")).toBe("meh");
    expect(moodOf("fine")).toBe("okay");
    expect(moodOf("content")).toBe("good");
    expect(moodOf("génial")).toBe("great");
  });

  it("give no word to two moods", () => {
    const words = moodOptions().flatMap((o) => [o.value, ...(o.keywords ?? [])]);
    expect(new Set(words).size).toBe(words.length);
  });
});
