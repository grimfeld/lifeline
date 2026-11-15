import { fold } from "./person";
import type { Membership, Person } from "./types";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const dayOr = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : undefined);

/**
 * A Household's memberships as stored, well-formed whatever wrote them: each
 * with a Person's id, and its since and until days only when they are days.
 * A Person listed twice counts once (the first).
 */
export function membershipsOf(raw: unknown): Membership[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Membership[] = [];
  for (const m of raw) {
    const personId = m && typeof m === "object" ? (m as Record<string, unknown>).personId : undefined;
    if (typeof personId !== "string" || !personId || seen.has(personId)) continue;
    seen.add(personId);
    const since = dayOr((m as Membership).since);
    const until = dayOr((m as Membership).until);
    out.push({ personId, ...(since ? { since } : {}), ...(until ? { until } : {}) });
  }
  return out;
}

/**
 * Who a Household stands for on a day (ADR 0117): the ids of whoever was a
 * member then, since and until both included, a blank bound meaning always.
 * What its link counts for, through Core's `linkable.members`.
 */
export function memberIdsOn(raw: unknown, day: string): string[] {
  return membershipsOf(raw)
    .filter((m) => (!m.since || m.since <= day) && (!m.until || day <= m.until))
    .map((m) => m.personId);
}

/** One member as the Household page lists them: the membership, and the Person's name. */
export interface MemberRow extends Membership {
  name: string;
}

const byName = (a: string, b: string) => fold(a).localeCompare(fold(b));

/**
 * A Household's members among `people` (the People visible in its Workspace),
 * A to Z. A membership whose Person is not among them (deleted, or moved to
 * another Workspace) is left out, never shown as a blank.
 */
export function membersOf(household: { members?: unknown }, people: readonly Pick<Person, "id" | "title">[]): MemberRow[] {
  const names = new Map(people.map((p) => [p.id, p.title]));
  const rows: MemberRow[] = [];
  for (const m of membershipsOf(household.members)) {
    const name = names.get(m.personId);
    if (name !== undefined) rows.push({ ...m, name });
  }
  return rows.sort((a, b) => byName(a.name, b.name));
}

/** A Person the Household can take as a member, as the name completion offers them. */
export interface MemberCandidate {
  value: string;
  label: string;
  keywords: string[];
  /** Their Relationship, when they have one. */
  description?: string;
}

/** Who can join a Household: the People not in it yet, by name or alias. */
export function memberCandidates(household: { members?: unknown }, people: readonly Pick<Person, "id" | "title" | "aliases" | "relationship">[]): MemberCandidate[] {
  const inIt = new Set(membershipsOf(household.members).map((m) => m.personId));
  return people
    .filter((p) => !inIt.has(p.id))
    .map((p) => ({ value: p.id, label: p.title, keywords: p.aliases, ...(p.relationship ? { description: p.relationship } : {}) }));
}

/** The Households a Person belongs to (several, maybe), A to Z by title. */
export function householdsOf<H extends { title: string; members?: unknown }>(personId: string, households: readonly H[]): H[] {
  return households.filter((h) => membershipsOf(h.members).some((m) => m.personId === personId)).sort((a, b) => byName(a.title, b.title));
}
