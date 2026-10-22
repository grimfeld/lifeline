import type { EditorView } from "@codemirror/view";
import type { LinkPlacement } from "@lifeline/core";

/** The attribute a body's container carries to name the Document it belongs to (ADR 0073). */
export const ORIGIN_ATTR = "data-origin";

/** The event the Markdown editor fires when its own selection moves — CodeMirror's selection is not always the DOM's. */
export const SELECTION_EVENT = "lifeline:selection";

/** Text selected inside a Document's body, with that Document and where on screen the selection ends. */
export interface BodySelection {
  text: string;
  originId: string;
  rect: { top: number; left: number; bottom: number };
  /**
   * Where in the body the text sits (ADR 0086), for writing a link around it:
   * exact offsets in an editor; in a rendered body, which of the page's
   * plain-prose occurrences it is. Null when that cannot be told.
   */
  placement: LinkPlacement | null;
  /** Set when the selection is in an editor: its live text, and a replacement made as one undoable edit. */
  editor?: { body: () => string; replace: (from: number, to: number, insert: string) => void };
}

/**
 * Finds the editor a `.cm-editor` element belongs to. Set by the editor's own
 * chunk when it loads (MarkdownEditorImpl), so this module, which the shell
 * mounts on every page, never imports CodeMirror: an editor on screen means
 * the chunk is there.
 */
let findView: (dom: HTMLElement) => EditorView | null = () => null;

export function provideEditorFinder(find: (dom: HTMLElement) => EditorView | null): void {
  findView = find;
}

function elementOf(node: Node | null): Element | null {
  return !node ? null : node instanceof Element ? node : node.parentElement;
}

/** What a rendered body shows that its source does not hold as plain prose: links (wikilinks, URLs) and code. */
const NOT_PROSE = "a, code, pre";

/**
 * Which plain-prose occurrence of `text` the range starts at, counting the way
 * the source's prose is counted (`writeLink`): text inside links and code is
 * left out on both sides. Null when the selection starts in one of those.
 */
function occurrenceIn(holder: Element, range: Range, text: string, lead: number): { occurrence: number; count: number } | null {
  const walker = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT);
  let all = "";
  let start = -1;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const skipped = n.parentElement?.closest(NOT_PROSE);
    const inside = skipped && holder.contains(skipped);
    if (start < 0) {
      if (n === range.startContainer) {
        if (inside) return null;
        start = all.length + range.startOffset;
      } else if (range.comparePoint(n, 0) >= 0) {
        if (inside) return null;
        start = all.length;
      }
    }
    if (!inside) all += n.textContent ?? "";
  }
  if (start < 0) return null;
  start += lead;
  let count = 0;
  let occurrence = -1;
  for (let i = all.indexOf(text); i >= 0; i = all.indexOf(text, i + text.length)) {
    if (i === start) occurrence = count;
    count++;
  }
  return occurrence < 0 ? null : { occurrence, count };
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
    const view = findView(cm);
    const origin = cm.closest(`[${ORIGIN_ATTR}]`)?.getAttribute(ORIGIN_ATTR);
    if (!view || !origin) return null;
    const { from, to, head } = view.state.selection.main;
    const raw = view.state.sliceDoc(from, to);
    const text = raw.trim();
    const at = view.coordsAtPos(head);
    if (!text || !at) return null;
    const start = from + raw.length - raw.trimStart().length;
    return {
      text,
      originId: origin,
      rect: { top: at.top, left: at.left, bottom: at.bottom },
      placement: { from: start, to: start + text.length },
      editor: {
        body: () => view.state.doc.toString(),
        replace: (f, t, insert) => {
          view.dispatch({ changes: { from: f, to: t, insert }, selection: { anchor: f + insert.length }, userEvent: "input" });
          view.focus();
        },
      },
    };
  }
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  const holder = elementOf(range.commonAncestorContainer)?.closest(`[${ORIGIN_ATTR}]`);
  const origin = holder?.getAttribute(ORIGIN_ATTR);
  if (!holder || !origin || elementOf(range.commonAncestorContainer)?.closest("input, textarea, [contenteditable=true]:not(.cm-content)")) return null;
  const raw = sel.toString();
  const text = raw.trim();
  if (!text) return null;
  const r = range.getBoundingClientRect();
  const found = occurrenceIn(holder, range, text, raw.length - raw.trimStart().length);
  return { text, originId: origin, rect: { top: r.top, left: r.left, bottom: r.bottom }, placement: found && { text, ...found } };
}
