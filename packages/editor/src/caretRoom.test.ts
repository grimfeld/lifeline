import { describe, expect, it } from "vitest";
import { caretRoom } from "./caretRoom";

/** A line of the editor's text, near enough (16px at 1.6). */
const LINE = 26;

describe("caretRoom", () => {
  it("keeps the caret a band away from either edge", () => {
    expect(caretRoom(600)).toEqual({ top: 240, bottom: 240, tail: 240 });
  });

  it("gives the document a tail as deep as the room below the caret", () => {
    const { bottom, tail } = caretRoom(600);
    expect(tail).toBe(bottom);
  });

  it("measures the band against the text that shows, and clears what covers it", () => {
    // 400px of scroller with a 48px bar over its foot: 352px of visible text.
    expect(caretRoom(400, 48)).toEqual({ top: 141, bottom: 189, tail: 189 });
  });

  it("never lets the two margins and a line outgrow the box", () => {
    for (const height of [0, 40, 80, 120, 200, 320, 480, 900]) {
      for (const covered of [0, 48]) {
        const { top, bottom } = caretRoom(height, covered);
        if (height - covered >= LINE + 2) expect(top + bottom + LINE).toBeLessThanOrEqual(height);
      }
    }
  });

  it("gives the band up on a short editor, keeping only what covers the foot", () => {
    expect(caretRoom(64, 48)).toEqual({ top: 0, bottom: 48, tail: 48 });
    expect(caretRoom(0)).toEqual({ top: 0, bottom: 0, tail: 0 });
  });

  it("still clears the bar before the box has been measured", () => {
    expect(caretRoom(0, 48).bottom).toBe(48);
  });
});
