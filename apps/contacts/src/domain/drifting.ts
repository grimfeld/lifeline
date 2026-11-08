import { addDays, diffDays, sourceOf, type DateStr, type LinkIndex } from "@lifeline/core";
import type { Person } from "./types";

/**
 * Drifting (CONTEXT.md, #404): the People I have not seen in a while. A
 * Contacts rule over Core's Seen and Mentioned sources, not a Core Report kind:
 * a Relationship and "excluded" are Person-only, and Core may not know them.
 * It is Core's "Not seen lately" (or "Not mentioned lately") ranking, kept to
 * the People who have a Relationship and have not been left out, plus those
 * never seen at all. Derived, never stored, never a reminder.
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

/**
 * The People to show: those with a Relationship, not excluded, who were seen on
 * no day in the last `days` days. The never seen come first (by name), then the
 * rest longest unseen first.
 */
export function drifting(index: LinkIndex, people: readonly Person[], { days = DRIFTING_DAYS, source = "seen", today }: { days?: number; source?: DriftSource; today: DateStr }): Drifter[] {
  const daysOf = sourceOf(source, today);
  const cutoff = addDays(today, -days);
  return people
    .filter((p) => p.relationship?.trim() && !p.excludedFromDrifting)
    .flatMap((person): Drifter[] => {
      const last = daysOf(index, person.id).at(-1) ?? null;
      if (last && last > cutoff) return [];
      return [{ person, last, daysSince: last ? diffDays(last, today) : null }];
    })
    .sort((a, b) => (a.last ?? "").localeCompare(b.last ?? "") || a.person.title.localeCompare(b.person.title));
}

export interface RelationshipGroup {
  relationship: string;
  count: number;
  /** By name. */
  people: Person[];
}

/** "Group by Relationship": the People under each Relationship label, labels in order; People with none are left out. */
export function groupByRelationship(people: readonly Person[]): RelationshipGroup[] {
  const groups = new Map<string, Person[]>();
  for (const p of people) {
    const label = p.relationship?.trim();
    if (label) groups.set(label, [...(groups.get(label) ?? []), p]);
  }
  return [...groups]
    .map(([relationship, ps]) => ({ relationship, count: ps.length, people: ps.sort((a, b) => a.title.localeCompare(b.title)) }))
    .sort((a, b) => a.relationship.localeCompare(b.relationship));
}
