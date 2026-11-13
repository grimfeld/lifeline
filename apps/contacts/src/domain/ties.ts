import type { Person, Tie } from "./types";

/** One Tie as a Person's page shows it: the other Person, and the labels from this Person's side. */
export interface TieRow {
  id: string;
  otherId: string;
  otherName: string;
  /** What the other Person is to this one ("daughter" on Anne's page). */
  label: string;
  /** What this Person is to the other ("mother"). */
  ownLabel: string;
}

/**
 * A Person's Ties, read from their own side (#412): stored once, so the same
 * Tie gives each end the other's word. A Tie whose other Person isn't in
 * `people` (deleted, or in another Workspace) is left out. In name order.
 */
export function tiesSeenFrom(personId: string, ties: readonly Tie[], people: readonly Pick<Person, "id" | "title">[]): TieRow[] {
  const names = new Map(people.map((p) => [p.id, p.title]));
  const rows: TieRow[] = [];
  for (const t of ties) {
    const mine = t.a === personId;
    if (!mine && t.b !== personId) continue;
    const otherId = mine ? t.b : t.a;
    const otherName = names.get(otherId);
    if (otherName === undefined) continue;
    rows.push({ id: t.id, otherId, otherName, label: mine ? t.labelB : t.labelA, ownLabel: mine ? t.labelA : t.labelB });
  }
  return rows.sort((x, y) => x.otherName.localeCompare(y.otherName));
}

/** A Person the Tie dialog can offer as the other end: anyone but this Person, found by name or alias. */
export interface TieCandidate {
  value: string;
  label: string;
  keywords: string[];
  /** Their Relationship, when they have one. */
  description?: string;
}

/** Who a Tie from `personId`'s page can go to: everyone else. */
export function tieCandidates(personId: string, people: readonly Pick<Person, "id" | "title" | "aliases" | "relationship">[]): TieCandidate[] {
  return people.filter((p) => p.id !== personId).map((p) => ({ value: p.id, label: p.title, keywords: p.aliases, ...(p.relationship ? { description: p.relationship } : {}) }));
}

/**
 * The Tie dialog's two questions, asked from `personName`'s page. A Tie is
 * between two People, never to me, so both name the People; the other one
 * once they are picked.
 */
export function tieQuestions(personName: string, otherName: string): { label: string; ownLabel: string } {
  if (!otherName) return { label: `They are ${personName}'s…`, ownLabel: `${personName} is their…` };
  return { label: `${otherName} is ${personName}'s…`, ownLabel: `${personName} is ${otherName}'s…` };
}

/** What the Tie dialog holds: the other Person's id ("" until picked) and the two words, as this page reads them. */
export interface TieDraft {
  otherId: string;
  label: string;
  ownLabel: string;
}

/** The Tie dialog as it opens: blank for a new Tie, else the row's other Person and words. */
export const tieDraft = (row: TieRow | undefined): TieDraft => (row ? { otherId: row.otherId, label: row.label, ownLabel: row.ownLabel } : { otherId: "", label: "", ownLabel: "" });

/** The other Person's name in the dialog: the one picked, else the row's (when they are not among `people`), else none yet. */
export function otherNameOf(people: readonly Pick<Person, "id" | "title">[], otherId: string, row: Pick<TieRow, "otherName"> | undefined): string {
  return people.find((p) => p.id === otherId)?.title ?? row?.otherName ?? "";
}
