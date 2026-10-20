import { describe, expect, it } from "vitest";
import { isWrittenDay, ownWords, writtenDates } from "./written";
import { DAILY_TEMPLATE } from "./types";

const day = (title: string, body: string) => ({ type: "daily", title, body });

describe("isWrittenDay", () => {
  it("a Day holding only its Template is not written", () => {
    expect(isWrittenDay(day("2026-10-20", DAILY_TEMPLATE))).toBe(false);
  });

  it("a Day holding only its daylog block is not written", () => {
    expect(isWrittenDay(day("2026-10-20", "```daylog\n```\n"))).toBe(false);
  });

  it("one line of the user's own makes it written", () => {
    expect(isWrittenDay(day("2026-10-20", `${DAILY_TEMPLATE}Rain.`))).toBe(true);
    expect(isWrittenDay(day("2026-10-20", DAILY_TEMPLATE.replace("### Citation du jour\n", "### Citation du jour\nok\n")))).toBe(true);
  });

  it("no Day is not written", () => {
    expect(isWrittenDay(undefined)).toBe(false);
  });

  it("frontmatter, empty list items and empty quotes are not words", () => {
    expect(isWrittenDay(day("2026-10-20", "---\nmood: 3\n---\n### Today\n\n- \n1. \n- [ ] \n>\n"))).toBe(false);
  });
});

describe("ownWords", () => {
  it("keeps what the user typed, one space between lines", () => {
    expect(ownWords(`${DAILY_TEMPLATE}First line\n\nSecond line`)).toBe("First line Second line");
  });
});

describe("writtenDates", () => {
  it("the dates of the written Days only, never another type's", () => {
    const dates = writtenDates([
      day("2026-10-20", DAILY_TEMPLATE),
      day("2026-10-19", `${DAILY_TEMPLATE}Words.`),
      { type: "thought", title: "2026-10-18", body: "words of a Thought" },
    ]);
    expect([...dates]).toEqual(["2026-10-19"]);
  });
});

describe("a rule is not frontmatter", () => {
  it("words between two rules at the top still count", () => {
    expect(isWrittenDay(day("2026-10-20", "---\nI wrote this.\n---\n"))).toBe(true);
  });
});
