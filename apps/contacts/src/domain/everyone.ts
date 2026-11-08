import { fold } from "./person";
import type { Person } from "./types";

export interface EveryoneFilter {
  /** Matches the name or any alias. */
  query?: string;
  /** Exactly this Relationship; empty for any. */
  relationship?: string;
  /** Carrying this Tag; empty for any. */
  tag?: string;
}

/** Everyone who passes the filters, by name. The filters combine. */
export function everyone(people: readonly Person[], { query = "", relationship = "", tag = "" }: EveryoneFilter): Person[] {
  const q = fold(query);
  return people
    .filter((p) => !relationship || p.relationship === relationship)
    .filter((p) => !tag || p.tags.includes(tag))
    .filter((p) => !q || [p.title, ...p.aliases].some((n) => fold(n).includes(q)))
    .sort((a, b) => a.title.localeCompare(b.title));
}

const distinct = (xs: string[]) => [...new Set(xs)].sort((a, b) => a.localeCompare(b));

/** The Relationships in use, once each, sorted. */
export const relationshipsOf = (people: readonly Person[]) => distinct(people.map((p) => p.relationship).filter(Boolean));

/** The Tags in use, once each, sorted. */
export const tagsOf = (people: readonly Person[]) => distinct(people.flatMap((p) => p.tags));
