import { normalizeName } from "@lifeline/core";
import type { Person } from "./types";

/** What the tidy-up reads of a Person. */
export type TidyInput = Pick<Person, "id" | "title" | "givenName" | "aliases">;

/** One Person whose given name is still typed as an alias, and what tidying it would write (ADR 0117). */
export interface TidyRow {
  id: string;
  title: string;
  /** The alias the title begins with, as typed: it becomes the Given name. */
  givenName: string;
  /** The rest of the title. */
  familyName: string;
  /** The aliases that duplicate the Given name (same name as a wikilink compares them): dropped. */
  drop: string[];
  /** The aliases that stay once those in `drop` go. */
  keep: string[];
}

/**
 * The alias a title begins with (a proper leading part: never the whole title; whole words, names compared as wikilinks do),
 * the longest when several do, with what is left of the title after it.
 */
function leadingAlias(title: string, aliases: readonly string[]): { alias: string; rest: string } | null {
  const words = title.trim().split(/\s+/).filter(Boolean);
  let best: { alias: string; rest: string } | null = null;
  for (const alias of aliases) {
    const want = normalizeName(alias);
    if (!want) continue;
    for (let n = 1; n < words.length; n++) {
      if (words.slice(0, n).join(" ").length > alias.trim().length) break;
      if (normalizeName(words.slice(0, n).join(" ")) !== want) continue;
      if (!best || alias.trim().length > best.alias.length) best = { alias: alias.trim(), rest: words.slice(n).join(" ") };
      break;
    }
  }
  return best;
}

/** The tidy-up proposed for one Person, or none: they have a Given name already, or no alias starts their title. */
export function tidyRowOf(person: TidyInput): TidyRow | null {
  if ((person.givenName ?? "").trim()) return null;
  const aliases = person.aliases ?? [];
  const hit = leadingAlias(person.title ?? "", aliases);
  if (!hit) return null;
  const key = normalizeName(hit.alias);
  return { id: person.id, title: person.title, givenName: hit.alias, familyName: hit.rest, drop: aliases.filter((a) => normalizeName(a) === key), keep: aliases.filter((a) => normalizeName(a) !== key) };
}

/** Everyone the tidy-up would change, A to Z. Empty once none is left: the offer goes. */
export function tidyCandidates(people: readonly TidyInput[]): TidyRow[] {
  return people.flatMap((p) => tidyRowOf(p) ?? []).sort((a, b) => a.title.localeCompare(b.title));
}

/** What tidying one Person writes: the names, and the aliases without the duplicated one (the others stay). None when nothing is left to tidy. */
export function tidyPatch(person: TidyInput): { givenName: string; familyName: string; aliases: string[] } | null {
  const row = tidyRowOf(person);
  if (!row) return null;
  return { givenName: row.givenName, familyName: row.familyName, aliases: row.keep };
}
