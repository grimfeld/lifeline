import TurndownService from "turndown";
import type { Handoff } from "@lifeline/core";
import { gmailThreadUrl, type Message } from "./types";

let td: TurndownService | null = null;

function turndown(): TurndownService {
  if (td) return td;
  td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-", emDelimiter: "_" });
  td.remove(["script", "style", "head", "title", "noscript"]);
  // Tracking pixels and spacer gifs are not content.
  td.addRule("tinyImages", {
    filter: (node) => {
      if (node.nodeName !== "IMG") return false;
      const el = node as HTMLImageElement;
      const w = Number(el.getAttribute("width") ?? NaN);
      const h = Number(el.getAttribute("height") ?? NaN);
      return (w > 0 && w <= 2) || (h > 0 && h <= 2) || !el.getAttribute("src");
    },
    replacement: () => "",
  });
  return td;
}

/** A Message's body as markdown: the HTML converted, else the plain text as it is. */
export function messageToMarkdown(m: Pick<Message, "html" | "text">): string {
  if (m.html.trim()) {
    const md = turndown().turndown(m.html);
    return tidy(md);
  }
  return tidy(m.text);
}

/** Collapse the whitespace newsletters leave behind: runs of blank lines, trailing spaces. */
export function tidy(md: string): string {
  return md
    .replace(/[ \t]+$/gm, "")
    .replace(/ /g, " ")
    // Turndown pads list markers to four columns; one space reads better in a body.
    .replace(/^(\s*)([-*]|\d+\.) {2,}/gm, "$1$2 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** What Mail hands to an Intake (ADR 0046): subject as title, the body as markdown, the Gmail link as origin, the sender as author. */
export function handoffOf(m: Message, address: string): Handoff {
  return {
    title: m.subject || "(no subject)",
    text: messageToMarkdown(m),
    url: gmailThreadUrl(address, m.threadId),
    author: m.from.name || m.from.address,
    date: m.date,
  };
}
