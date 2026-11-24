/**
 * Whether Esc, pressed with focus on `target`, is the Hub's to take (#663):
 * to close a full-screen page or leave full screen. Never when what has focus
 * keeps its own Esc:
 * - a dialog, a menu, a Peek or the palette, all portalled outside the Hub;
 * - a field being typed in;
 * - a control in a page's or Window's content (a Base cell's checkbox or select
 *   being edited), which may end its own editing on Esc without saying so.
 * A bar's own buttons ("Hub · Esc", Close) and anything that is no control
 * (the page or Window itself, the body) let it through.
 */
export function hubTakesEscape(target: EventTarget | null, hub: Element | null): boolean {
  if (!(target instanceof HTMLElement) || target === target.ownerDocument.body) return true;
  if (!hub?.contains(target)) return false;
  if (target.isContentEditable || target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']")) return false;
  if (target.closest("[data-window-bar], [data-page-bar]")) return true;
  return !target.matches("button, a[href], [role]");
}
