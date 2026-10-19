/**
 * The page reader (ADR 0080, CONTEXT.md "Lifeline extension"): the Handoff a
 * page makes when the person sends it to Lifeline. It reads the selection, the
 * title, the URL and the author and date the page declares — nothing else, and
 * nothing site-specific (Gmail's included).
 */
import type { Handoff } from "@lifeline/handoff";
import TurndownService from "turndown";

export function readPage(doc: Document, selection: Selection | null): Handoff {
  const handoff: Handoff = { title: doc.title.trim(), text: selectionMarkdown(doc, selection), url: doc.URL };
  const author = declared(doc, AUTHOR_META);
  if (author) handoff.author = author;
  const date = declared(doc, DATE_META);
  if (date) handoff.date = date;
  return handoff;
}

/** Where a page declares who wrote it, first match wins. */
const AUTHOR_META = ['meta[name="author"]', 'meta[property="article:author"]', 'meta[name="article:author"]'];
/** Where a page declares when it was published, first match wins. */
const DATE_META = ['meta[property="article:published_time"]', 'meta[name="article:published_time"]', 'meta[itemprop="datePublished"]', 'meta[name="datePublished"]'];

/** The first non-blank `content` of those meta tags; "" when the page declares none — never a guess. */
function declared(doc: Document, selectors: string[]): string {
  for (const sel of selectors) {
    const value = doc.querySelector(sel)?.getAttribute("content")?.trim();
    if (value) return value;
  }
  return "";
}

/** The selection as markdown; "" when nothing is selected. */
function selectionMarkdown(doc: Document, selection: Selection | null): string {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return "";
  const box = doc.createElement("div");
  for (let i = 0; i < selection.rangeCount; i++) box.append(selection.getRangeAt(i).cloneContents());
  // A link keeps working away from its page: its address is made absolute against the page's.
  for (const a of box.querySelectorAll("a[href]")) {
    try {
      a.setAttribute("href", new URL(a.getAttribute("href")!, doc.baseURI).href);
    } catch {
      // An address the page itself could not resolve stays as it was.
    }
  }
  return turndown().turndown(box).trim();
}

function turndown(): TurndownService {
  const t = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", hr: "---" });
  t.remove(["script", "style", "noscript"]);
  return t;
}
