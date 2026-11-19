import { addDays, agoText, diffDays, lastTalkedExchange, sourceOf, type DateStr, type LinkIndex, type ReportSource } from "@lifeline/core";
import { EXCHANGE_KINDS, exchangeKindOf, type ExchangeKind } from "./exchanges";
import type { Person } from "./types";

/**
 * Drifting (CONTEXT.md, #404, ADR 0131): the People I have not been in touch
 * with in a while. A Contacts rule over Core's Seen, Talked and Mentioned
 * sources, not a Core Report kind: a Relationship and "excluded" are
 * Person-only, and Core may not know them. In touch is the later of last Seen
 * and last Talked, read as dates and never added as counts; Not mentioned is
 * the alternative. Kept to the People who have a Relationship and have not
 * been left out, plus those never in touch at all. 90 days, fixed: no setting
 * changes it. Derived, never stored, never a reminder.
 */
export const DRIFTING_DAYS = 90;

/** What Drifting ranks by: when I was last in touch (the default), or last mentioned. */
export type DriftSource = "inTouch" | "mentioned";

/** How someone was last in touch: seen at an Event, an Exchange of a kind, or (switched) mentioned. */
export type TouchHow = "seen" | ExchangeKind | "mentioned";

/** Someone's last day in touch (or mentioned), and how. */
export interface LastTouch {
  day: DateStr;
  how: TouchHow;
}

export interface Drifter {
  person: Person;
  /** The last day they were in touch (or mentioned); null when never. */
  last: DateStr | null;
  /** How, on that day; null when never. */
  how: TouchHow | null;
  /** Days since then; null when never. */
  daysSince: number | null;
}

/** Each Person's last day of one Report source, undefined when never: one walk of the index, for a screen to share. */
export function lastDays(index: LinkIndex, people: readonly Person[], { source, today }: { source: ReportSource; today: DateStr }): Map<string, DateStr | undefined> {
  const daysOf = sourceOf(source, today);
  return new Map(people.map((p) => [p.id, daysOf(index, p.id).at(-1)]));
}

/**
 * Each Person's last touch, undefined when never. In touch: the later of
 * their last Seen day (`seen`, passed when the screen has it already) and the
 * newest Exchange with them, by its kind; seen wins a day both happened.
 * Mentioned: their last Mentioned day.
 */
export function lastTouches(
  index: LinkIndex,
  people: readonly Person[],
  { source, today, seen }: { source: DriftSource; today: DateStr; seen?: ReadonlyMap<string, DateStr | undefined> },
): Map<string, LastTouch | undefined> {
  if (source === "mentioned") {
    const mentioned = lastDays(index, people, { source: "mentioned", today });
    return new Map(people.map((p) => [p.id, touch(mentioned.get(p.id), "mentioned")]));
  }
  const seenDay = seen ?? lastDays(index, people, { source: "seen", today });
  return new Map(
    people.map((p) => {
      const lastSeen = seenDay.get(p.id);
      const talked = lastTalkedExchange(index, p.id, today);
      if (talked && (!lastSeen || talked.day > lastSeen)) return [p.id, { day: talked.day, how: exchangeKindOf(talked.exchange.kind) }];
      return [p.id, touch(lastSeen, "seen")];
    }),
  );
}

const touch = (day: DateStr | undefined, how: TouchHow): LastTouch | undefined => (day ? { day, how } : undefined);

/**
 * The People to show, over each one's last touch already worked out (`lastTouches`, so a
 * screen walks the index once): those with a Relationship, not excluded, who were in touch
 * on no day in the last `DRIFTING_DAYS` days. The never in touch come first (by name), then
 * the rest longest out of touch first.
 */
export function driftingFrom(people: readonly Person[], last: ReadonlyMap<string, LastTouch | undefined>, today: DateStr): Drifter[] {
  const cutoff = addDays(today, -DRIFTING_DAYS);
  return people
    .filter(followed)
    .map((person) => drifterOf(person, last.get(person.id), today))
    .filter((d) => d.last === null || d.last <= cutoff)
    .sort(longestUnseenFirst);
}

/** The word for how: "seen", "mentioned", or the Exchange's kind ("call", "video call"). */
const howWord = (how: TouchHow): string => EXCHANGE_KINDS.find((k) => k.value === how)?.label.toLowerCase() ?? how;

/** A Drifting row's words: "Never in touch" (or "Never mentioned"), else how and how long ago: "call · 120 days ago". */
export function driftLine(d: Pick<Drifter, "how" | "daysSince">, source: DriftSource): string {
  if (d.how === null || d.daysSince === null) return source === "mentioned" ? "Never mentioned" : "Never in touch";
  return `${howWord(d.how)} · ${agoText(d.daysSince)}`;
}

/** Drifting looks only at People with a Relationship who were not left out of it. */
const followed = (p: Person) => p.relationship.trim() !== "" && !p.excludedFromDrifting;

const drifterOf = (person: Person, last: LastTouch | undefined, today: DateStr): Drifter => ({ person, last: last?.day ?? null, how: last?.how ?? null, daysSince: last ? diffDays(last.day, today) : null });

/** The never in touch first (by name), then the rest longest out of touch first. */
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
