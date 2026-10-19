import { useMemo } from "react";
import type { CardFieldDef, CardOption, CardSettings } from "@lifeline/core";
import { useSources } from "../data/works";
import { useQuotes } from "../data/quotes";
import type { Quote } from "../domain/types";
import { KNOWN_FAMILIES, familyLabel, type SourceItem, type WorkFilter } from "../domain/works";

/** The family knob every quote card carries; "" = any family. */
export const familyField: CardFieldDef = {
  kind: "select",
  label: "Family",
  default: "",
  options: [{ value: "", label: "Any family" }, ...KNOWN_FAMILIES.map((f) => ({ value: f.value, label: f.plural }))],
};

export const familyOf = (settings: CardSettings): WorkFilter => (typeof settings.family === "string" ? (settings.family as WorkFilter) : "");

/** Optional "only this tag" knob for quote cards; "" = any tag. */
export const quoteTagField: CardFieldDef = { kind: "text", label: "Only tag", default: "", placeholder: "e.g. courage" };

export const tagOf = (settings: CardSettings): string => (typeof settings.tag === "string" ? settings.tag.trim().replace(/^#/, "").toLowerCase() : "");
export const countOf = (settings: CardSettings, fallback: number): number => (typeof settings.count === "number" && settings.count > 0 ? settings.count : fallback);

/** Quotes filtered by the card's family and tag knobs, with their works by id. */
export function useQuotePool(settings: CardSettings): { pool: Quote[]; byId: Map<string, SourceItem>; items: SourceItem[] } {
  const items = useSources();
  const quotes = useQuotes();
  const family = familyOf(settings);
  const tag = tagOf(settings);
  return useMemo(() => {
    const byId = new Map(items.map((m) => [m.id, m]));
    const pool = quotes.filter((q) => (!family || byId.get(q.source)?.family === family) && (!tag || (q.tags ?? []).includes(tag)));
    return { pool, byId, items };
  }, [items, quotes, family, tag]);
}

/** Options hook for the `item` entity knob: every quotable work by title. */
export function useWorkOptions(): CardOption[] {
  const items = useSources();
  return [...items].sort((a, b) => a.title.localeCompare(b.title)).map((m) => ({ value: m.id, label: m.title }));
}

/** Instance title for "Quotes of…": "Quotes · <title>". */
export function useQuotesOfTitle(settings: CardSettings): string {
  const items = useSources();
  const t = items.find((m) => m.id === settings.item)?.title;
  return t ? `Quotes · ${t}` : "Quotes of…";
}

/** "Base" or "Base · Books" — the instanceTitle convention shared by every quote card. */
export const titleWithFamily = (base: string, family: unknown) =>
  typeof family === "string" && family && KNOWN_FAMILIES.some((f) => f.value === family) ? `${base} · ${familyLabel(family, true)}` : base;
