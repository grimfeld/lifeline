import type { DateStr } from "@lifeline/core";
import type { Quote } from "./types";
import type { SourceItem } from "./works";

/** Opening words of a quote, for link targets and titles: ≤ n chars, word-safe, with an ellipsis when cut. */
export function quoteName(text: string, n = 48): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n);
  const i = cut.lastIndexOf(" ");
  return (i > 20 ? cut.slice(0, i) : cut).trimEnd() + "…";
}

/** The blockquote inserted into a note: text lines, then an attribution line linking the item. */
export function quoteMarkdown(q: Quote, item: SourceItem | undefined): string {
  const lines = q.body.trim().split(/\r?\n/).map((l) => `> ${l}`.trimEnd());
  const who = item ? `[[${item.title}]]${item.creator ? `, ${item.creator}` : ""}` : "";
  const loc = q.locator.trim();
  const tail = [who, loc].filter(Boolean).join(", ");
  return `${lines.join("\n")}\n> — ${tail}`.trimEnd() + "\n";
}

/** Deterministic daily pick: the same quote all day, different tomorrow. */
export function quoteOfTheDay<T extends { id: string }>(pool: T[], date: DateStr): T | undefined {
  if (pool.length === 0) return undefined;
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  let h = 0;
  for (const ch of date) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return sorted[h % sorted.length];
}

export function quotesOn(quotes: Quote[], day: DateStr): Quote[] {
  return quotes.filter((q) => q.capturedOn === day);
}

export function searchQuotes(quotes: Quote[], items: Map<string, SourceItem>, q: string): Quote[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return quotes;
  return quotes.filter((x) => {
    const item = items.get(x.source);
    return [x.body, x.comment, x.locator, item?.title ?? "", item?.creator ?? ""].some((s) => s.toLowerCase().includes(needle)) || (x.tags ?? []).some((t) => t.includes(needle.replace(/^#/, "")));
  });
}
