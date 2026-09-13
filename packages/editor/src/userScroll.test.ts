import { describe, expect, it } from "vitest";
import { SETTLE_MS, isUserScrollUp } from "./userScroll";

/** The scroller has been still long enough that anything moving it is a finger. */
const STILL = Infinity;

describe("isUserScrollUp", () => {
  it("reads a deliberate scroll up as the user asking", () => {
    expect(isUserScrollUp(500, 400, STILL)).toBe(true);
  });

  it("ignores the caret band's own few pixels", () => {
    expect(isUserScrollUp(500, 495, STILL)).toBe(false);
  });

  it("ignores scrolling down, which is not the opposite ask", () => {
    expect(isUserScrollUp(400, 500, STILL)).toBe(false);
  });

  // The regression: collapsing the header resizes the scroller every frame, and
  // the caret band re-lays the text out each time. That reflow scrolls up by far
  // more than the slack, so slack alone read it as the user asking — the header
  // came back, resized the box again, and the focused line oscillated.
  it("does not mistake the reflow after the box moves for a gesture", () => {
    expect(isUserScrollUp(500, 340, 0)).toBe(false);
    expect(isUserScrollUp(500, 340, SETTLE_MS - 1)).toBe(false);
  });

  it("takes the user's scroll again once the box has settled", () => {
    expect(isUserScrollUp(500, 340, SETTLE_MS)).toBe(true);
  });
});
