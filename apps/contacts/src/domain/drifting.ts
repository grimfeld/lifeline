import { addDays, diffDays, sourceOf, type DateStr, type LinkIndex } from "@lifeline/core";
import type { Person } from "./types";

/**
 * Drifting (CONTEXT.md, #404): the People I have not seen in a while. A
 * Contacts rule over Core's Seen and Mentioned sources, not a Core Report kind:
 * a Relationship and "excluded" are Person-only, and Core may not know them.
 * It is Core's "Not seen lately" (or "Not mentioned lately") ranking, kept to
 * the People who have a Relationship and have not been left out, plus those
 * never seen at all. Not seen in 90 days, fixed: no setting changes it.
 * Derived, never stored, never a reminder.
 */
export const DRIFTING_DAYS = 90;

export type DriftSource = "seen" | "mentioned";

export interface Drifter {
  person: Person;
  /** The last day they were seen (or mentioned); null when never. */
  last: DateStr | null;
  /** Days since then; null when never. */
  daysSince: number | null;
}

/** Each Person's last day seen (or mentioned), undefined when never: one walk of the index, for a screen to share. */
export function lastDays(index: LinkIndex, people: readonly Person[], { source = "seen", today }: { source?: DriftSource; today: DateStr }): Map<string, DateStr | undefined> {
  const daysOf = sourceOf(source, today);
  return new Map(people.map((p) => [p.id, daysOf(index, p.id).at(-1)]));
}

/**
 * The People to show, over each one's last day already worked out (`lastDays`, so a
 * screen walks the index once): those with a Relationship, not excluded, who were seen
 * on no day in the last `DRIFTING_DAYS` days. The never seen come first (by name), then
 * the rest longest unseen first.
 */
export function driftingFrom(people: readonly Person[], last: ReadonlyMap<string, DateStr | undefined>, today: DateStr): Drifter[] {
  const cutoff = addDays(today, -DRIFTING_DAYS);
  return people
    .filter(followed)
    .map((person) => drifterOf(person, last.get(person.id) ?? null, today))
    .filter((d) => d.last === null || d.last <= cutoff)
    .sort(longestUnseenFirst);
}

/** Drifting looks only at People with a Relationship who were not left out of it. */
const followed = (p: Person) => p.relationship.trim() !== "" && !p.excludedFromDrifting;

const drifterOf = (person: Person, last: DateStr | null, today: DateStr): Drifter => ({ person, last, daysSince: last === null ? null : diffDays(last, today) });

/** The never seen first (by name), then the rest longest unseen first. */
const longestUnseenFirst = (a: Drifter, b: Drifter) => (a.last ?? "").localeCompare(b.last ?? "") || a.person.title.localeCompare(b.person.title);

export interface RelationshipGroup {
  relationship: string;
  count: number;
  /** By name. */
  people: Person[];
}

/** "Group by Relationship": the People under each Relationship label, labels in order; People with none are left out. */
export function groupByRelationship(people: readonly Person[]): RelationshipGroup[] {
  const labels = [...new Set(people.map((p) => p.relationship.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return labels.map((relationship) => {
    const ps = people.filter((p) => p.relationship.trim() === relationship).sort((a, b) => a.title.localeCompare(b.title));
    return { relationship, count: ps.length, people: ps };
  });
}
