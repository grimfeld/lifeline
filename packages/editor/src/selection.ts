import { EditorView } from "@codemirror/view";

/** The attribute a body's container carries to name the Document it belongs to (ADR 0073). */
export const ORIGIN_ATTR = "data-origin";

/** The event the Markdown editor fires when its own selection moves — CodeMirror's selection is not always the DOM's. */
export const SELECTION_EVENT = "lifeline:selection";

/** Text selected inside a Document's body, with that Document and where on screen the selection ends. */
export interface BodySelection {
  text: string;
  originId: string;
  rect: { top: number; left: number; bottom: number };
}

function elementOf(node: Node | null): Element | null {
  return !node ? null : node instanceof Element ? node : node.parentElement;
}

/**
 * What is selected in a body right now — inside the Markdown editor or a read
 * view whose container names its Document — or null. Anything else (a form
 * field, a page's chrome, a selection spanning two bodies) is not a body
 * selection. The editor is read through CodeMirror itself: it draws its own
 * selection and renders only the visible lines, so the DOM's can be partial.
 */
export function readBodySelection(): BodySelection | null {
  const sel = typeof window === "undefined" ? null : window.getSelection();
  const anchor = elementOf(sel?.anchorNode ?? null) ?? document.activeElement;
  const cm = anchor?.closest(".cm-editor");
  if (cm instanceof HTMLElement) {
    const view = EditorView.findFromDOM(cm);
    const origin = cm.closest(`[${ORIGIN_ATTR}]`)?.getAttribute(ORIGIN_ATTR);
    if (!view || !origin) return null;
    const { from, to, head } = view.state.selection.main;
    const text = view.state.sliceDoc(from, to).trim();
    const at = view.coordsAtPos(head);
    if (!text || !at) return null;
    return { text, originId: origin, rect: { top: at.top, left: at.left, bottom: at.bottom } };
  }
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const holder = elementOf(range.commonAncestorContainer)?.closest(`[${ORIGIN_ATTR}]`);
  const origin = holder?.getAttribute(ORIGIN_ATTR);
  if (!origin || elementOf(range.commonAncestorContainer)?.closest("input, textarea, [contenteditable=true]:not(.cm-content)")) return null;
  const text = sel.toString().trim();
  if (!text) return null;
  const r = range.getBoundingClientRect();
  return { text, originId: origin, rect: { top: r.top, left: r.left, bottom: r.bottom } };
}
