import { useMemo } from "react";
import type { CardFieldDef, CardOption, CardSettings } from "@lifeline/core";
import { useMedia } from "../data/repo";
import { useQuotes } from "../data/quotes";
import type { MediaItem, Quote } from "../domain/types";
import type { MediumFilter } from "../domain/cardQueries";
import { mediumOf } from "./shared";

/** Optional "only this tag" knob for quote cards; "" = any tag. */
export const quoteTagField: CardFieldDef = { kind: "text", label: "Only tag", default: "", placeholder: "e.g. courage" };

export const tagOf = (settings: CardSettings): string => (typeof settings.tag === "string" ? settings.tag.trim().replace(/^#/, "").toLowerCase() : "");
export const countOf = (settings: CardSettings, fallback: number): number => (typeof settings.count === "number" && settings.count > 0 ? settings.count : fallback);

/** Quotes filtered by the card's medium and tag knobs, with their items by id. */
export function useQuotePool(settings: CardSettings): { pool: Quote[]; byId: Map<string, MediaItem>; items: MediaItem[] } {
  const items = useMedia();
  const quotes = useQuotes();
  const medium: MediumFilter = mediumOf(settings);
  const tag = tagOf(settings);
  return useMemo(() => {
    const byId = new Map(items.map((m) => [m.id, m]));
    const pool = quotes.filter((q) => (!medium || byId.get(q.mediaId)?.type === medium) && (!tag || (q.tags ?? []).includes(tag)));
    return { pool, byId, items };
  }, [items, quotes, medium, tag]);
}

/** Options hook for the `item` entity knob: every media item by title. */
export function useMediaItemOptions(): CardOption[] {
  const items = useMedia();
  return [...items].sort((a, b) => a.title.localeCompare(b.title)).map((m) => ({ value: m.id, label: m.title }));
}

/** Instance title for "Quotes of…": "Quotes · <title>". */
export function useQuotesOfTitle(settings: CardSettings): string {
  const items = useMedia();
  const t = items.find((m) => m.id === settings.item)?.title;
  return t ? `Quotes · ${t}` : "Quotes of…";
}
