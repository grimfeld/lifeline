import { diffDays, notMentionedSince, sourceOf, type DateStr, type LinkIndex } from "@lifeline/core";
import { PERSON, type Person } from "./types";

/**
 * Drifting (CONTEXT.md, #404): the People I have not seen in a while. A
 * Contacts rule over Core's Seen and Mentioned sources, not a Core Report kind:
 * a Relationship and "excluded" are Person-only, and Core may not know them.
 * It is Core's "Not seen lately" (or "Not mentioned lately") ranking, kept to
 * the People who have a Relationship and have not been left out. Derived, never
 * stored, never a reminder.
 */
export const DRIFTING_DAYS = 90;

export type DriftSource = "seen" | "mentioned";

export interface Drifter {
  person: Person;
  /** The last day they were seen (or mentioned). */
  last: DateStr;
  /** Days since then. */
  daysSince: number;
}

/**
 * The People to show, longest unseen first: those with a Relationship, not
 * excluded, who were seen before but on no day in the last `days` days. Nobody
 * never seen at all: there is no touch to have lost.
 */
export function drifting(index: LinkIndex, people: readonly Person[], { days = DRIFTING_DAYS, source = "seen", today }: { days?: number; source?: DriftSource; today: DateStr }): Drifter[] {
  const eligible = new Map(people.filter((p) => p.relationship?.trim() && !p.excludedFromDrifting).map((p) => [p.id, p]));
  return notMentionedSince(index, PERSON, days, today, sourceOf(source, today))
    .flatMap((r) => {
      const person = eligible.get(r.docId);
      return person ? [{ person, last: r.last, daysSince: diffDays(r.last, today) }] : [];
    })
    .sort((a, b) => a.last.localeCompare(b.last) || a.person.title.localeCompare(b.person.title));
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
