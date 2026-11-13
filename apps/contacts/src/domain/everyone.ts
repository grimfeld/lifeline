import { formatHuman, type DateStr } from "@lifeline/core";
import { fold } from "./person";
import type { Drifter } from "./drifting";
import { upcomingOccasions, type UpcomingOccasion } from "./occasions";
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

/** A filter's value while someone still carries it; none once the last of them changed. */
export const activeFilter = (inUse: readonly string[], value: string) => (inUse.includes(value) ? value : "");

/** When a Person was last seen, as their row says it. */
export const lastSeenLabel = (lastSeen: DateStr | undefined) => (lastSeen ? `Last seen ${formatHuman(lastSeen)}` : "Never seen");

/** Everyone A to Z (#422): the People in the order given, under the first letter of their name, accents aside; a name that starts with no letter goes under #. */
export function byLetter(people: readonly Person[]): [string, Person[]][] {
  const letters = new Map<string, Person[]>();
  for (const p of people) {
    const first = fold(p.title).charAt(0).toUpperCase();
    const letter = /\p{L}/u.test(first) ? first : "#";
    letters.set(letter, [...(letters.get(letter) ?? []), p]);
  }
  return [...letters.entries()];
}

/** What a row says about someone at a glance (#422): their next Occasion soon, and how long they have drifted (null when never seen). */
export interface RowNews {
  upcoming: Map<string, UpcomingOccasion>;
  drifting: Map<string, number | null>;
}

/** Each row's news: the nearest Occasion in the next `days` days, and the days since for those drifting. */
export function rowNews(people: readonly Person[], drifters: readonly Drifter[], today: DateStr, days: number): RowNews {
  const upcoming = new Map<string, UpcomingOccasion>();
  for (const u of upcomingOccasions(people, today, days)) if (!upcoming.has(u.personId)) upcoming.set(u.personId, u);
  return { upcoming, drifting: new Map(drifters.map((d) => [d.person.id, d.daysSince])) };
}
