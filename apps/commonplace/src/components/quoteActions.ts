import { toast } from "@lifeline/ui";
import { quoteMarkdown } from "../domain/quotes";
import type { Quote } from "../domain/types";
import type { QuotedWork } from "../domain/works";

/** Event the Notes App listens for to append text to today's daily note. */
export const APPEND_TO_DAILY_EVENT = "lifeline:append-to-daily";
export const JOURNAL_HREF = "/notes/journal";

/** Copy the quote as a markdown blockquote (with wikilink attribution) to the clipboard. */
export async function copyQuote(q: Quote, item: QuotedWork | undefined): Promise<void> {
  const md = quoteMarkdown(q, item);
  try {
    await navigator.clipboard.writeText(md);
    toast.success("Copied as blockquote — paste it into your note");
  } catch {
    toast.error("Could not copy to the clipboard");
  }
}

/**
 * "Insert into today's note": the Media App cannot import the Notes App, so
 * it dispatches a window CustomEvent `lifeline:append-to-daily` with
 * `{ detail: { text } }` (the blockquote markdown) and navigates to the
 * journal. The Notes App listens for this event and appends `text` to today's
 * daily note. The markdown is also put on the clipboard as a fallback.
 */
export function insertQuoteIntoJournal(q: Quote, item: QuotedWork | undefined, navigate: (to: string) => void): void {
  const text = quoteMarkdown(q, item);
  window.dispatchEvent(new CustomEvent(APPEND_TO_DAILY_EVENT, { detail: { text } }));
  void navigator.clipboard?.writeText(text).catch(() => {});
  navigate(JOURNAL_HREF);
}
