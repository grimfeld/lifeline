/** How much of the visible text the caret keeps between itself and either edge. */
const BAND = 0.4;

/**
 * The least text a band may leave between the two margins. Margins that do not
 * leave room for the line they are keeping in view make the editor scroll back
 * and forth over it, so on a short box the band gives way instead.
 */
const MIN_GAP = 64;

export interface CaretRoom {
  /** Scroll margin above the caret. */
  top: number;
  /** Scroll margin below it — the band plus whatever covers the editor's foot. */
  bottom: number;
  /** Blank space after the document's last line. */
  tail: number;
}

/**
 * The room the editor keeps around the caret and after its last line, from the
 * scroller's `height` and how much of its foot something else is drawn over
 * (`covered` — the phone's key accessory bar). One band, spent twice:
 *
 * - as **scroll margins**, so a line scrolled into view lands a band away from
 *   the visible edges rather than against them: the line being written settles
 *   near the middle of the screen instead of riding its bottom.
 * - as the document's **tail**, so the end of a note can go there too. Without
 *   it the last line is wherever the scroller ends — on a phone, underneath the
 *   accessory bar and the keyboard, with nothing left to scroll.
 */
export function caretRoom(height: number, covered = 0): CaretRoom {
  const visible = Math.max(0, height - covered);
  const band = Math.max(0, Math.round(Math.min(visible * BAND, (visible - MIN_GAP) / 2)));
  return { top: band, bottom: covered + band, tail: covered + band };
}
