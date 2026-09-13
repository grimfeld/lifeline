/**
 * How far up the scroller must move before it counts as the user asking for the
 * chrome back. A few pixels of slack, so the caret band's own nudge does not
 * read as a gesture.
 */
const SLACK = 8;

/**
 * How long after the editor's own box changes its scrolling stops counting as
 * the user's. Collapsing the header animates over 200ms (`DocumentEditor`), and
 * every frame of it resizes the scroller and re-lays the caret out; 350ms
 * carries past the end of that transition with room for the frame that settles
 * it.
 */
export const SETTLE_MS = 350;

/**
 * Whether an upward scroll is the user's gesture or the editor's own reflow.
 *
 * Scrolling up is how the header is asked back (ADR 0021, amended), but the
 * editor scrolls itself too: the caret band re-lays the text out whenever the
 * box changes, and the box changes *because* the header collapsed. Read
 * naively, that reflow asks for the header back, which expands it, which
 * changes the box again — the caret oscillates and the line under it jumps.
 *
 * CodeMirror offers no "this update scrolled the view" flag to separate the
 * two, so the cause is tracked on this side: a scroll that lands within
 * `SETTLE_MS` of the editor's own box moving is the reflow settling, not a
 * finger. The slack alone cannot do it — a header collapse moves the scroller
 * by far more than a few pixels.
 *
 * @param from    Where the scroller was.
 * @param to      Where it is now.
 * @param since   Time since the box last changed, in ms (`Infinity` when it has
 *                been still, which is the steady state while writing).
 */
export function isUserScrollUp(from: number, to: number, since: number): boolean {
  if (since < SETTLE_MS) return false;
  return to < from - SLACK;
}
