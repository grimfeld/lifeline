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
