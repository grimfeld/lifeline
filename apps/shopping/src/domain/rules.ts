import type { Aisle, Need } from "./types";

/** How long a Bought Need stays in the "Bought recently" strip, where a wrong tick is undone. */
export const BOUGHT_RECENTLY_DAYS = 7;

/**
 * The same thing is the same title, case and outer spaces aside (CONTEXT.md
 * "Need"): "Milk" is "milk", "oat milk" is another Need. Nothing fuzzier —
 * nothing is merged on a guess.
 */
export const titleKey = (title: string): string => title.trim().toLowerCase();

export function findByTitle(list: Need[], title: string): Need | undefined {
  const k = titleKey(title);
  if (!k) return undefined;
  return list.find((n) => titleKey(n.title) === k);
}

export const isListed = (n: Pick<Need, "boughtOn">): boolean => !n.boughtOn;

/** What adding a title does: make a Need, bring a Bought one back, or nothing — it is already listed. */
export type AddOutcome = { kind: "new" } | { kind: "revive"; need: Need } | { kind: "listed"; need: Need };

export function addOutcome(list: Need[], title: string): AddOutcome {
  const hit = findByTitle(list, title);
  if (!hit) return { kind: "new" };
  return isListed(hit) ? { kind: "listed", need: hit } : { kind: "revive", need: hit };
}

/** A note typed onto a Need already listed is added to what it says, never replacing it. */
export function appendNote(existing: string, extra: string): string {
  const a = existing.trim();
  const b = extra.trim();
  if (!b || a === b) return a;
  return a ? `${a}; ${b}` : b;
}

/** Renaming onto another Need's title is refused; `selfId` is the Need being renamed. */
export function renameClash(list: Need[], selfId: string, title: string): Need | undefined {
  const k = titleKey(title);
  if (!k) return undefined;
  return list.find((n) => n.id !== selfId && titleKey(n.title) === k);
}

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

/** Aisles in my own order — the walk — ties by name. */
export function sortAisles(list: Aisle[]): Aisle[] {
  return [...list].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0) || byTitle(a, b));
}

/** Oldest onto the list first. */
export function byListedAt(a: Need, b: Need): number {
  return (a.listedAt || "").localeCompare(b.listedAt || "") || byTitle(a, b);
}

export interface AisleGroup {
  /** null = buyable anywhere, and heads the list. */
  aisle: Aisle | null;
  needs: Need[];
}

/**
 * The list as read in the shop: Anywhere first, then each Aisle in my order,
 * oldest first inside. A Need pointing at no existing Aisle is buyable
 * anywhere. Empty Aisles are kept so the walk stays visible.
 */
export function groupByAisle(needs: Need[], aisles: Aisle[]): AisleGroup[] {
  const sorted = sortAisles(aisles);
  const ids = new Set(sorted.map((a) => a.id));
  const ordered = [...needs].sort(byListedAt);
  return [{ aisle: null, needs: ordered.filter((n) => !ids.has(n.aisleId)) }, ...sorted.map((a) => ({ aisle: a, needs: ordered.filter((n) => n.aisleId === a.id) }))];
}

/** Bought within the window, latest first — the strip where a wrong tick is undone. */
export function boughtRecently(needs: Need[], sinceDay: string): Need[] {
  return needs.filter((n) => !!n.boughtOn && n.boughtOn >= sinceDay).sort((a, b) => b.boughtOn.localeCompare(a.boughtOn) || byTitle(a, b));
}

/** Titles of Bought Needs, offered back while typing. */
export function suggestions(needs: Need[]): string[] {
  return needs
    .filter((n) => !isListed(n))
    .map((n) => n.title)
    .sort((a, b) => a.localeCompare(b));
}

/** Ranks renumbered 0..n after moving one Aisle up (-1) or down (+1); unchanged ids are left out. */
export function moveAisle(aisles: Aisle[], id: string, dir: -1 | 1): { id: string; rank: number }[] {
  const sorted = sortAisles(aisles);
  const i = sorted.findIndex((a) => a.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= sorted.length) return [];
  [sorted[i], sorted[j]] = [sorted[j]!, sorted[i]!];
  return sorted.map((a, rank) => ({ id: a.id, rank })).filter((r) => aisles.find((a) => a.id === r.id)?.rank !== r.rank);
}

/** The rank a new Aisle takes: after every other. */
export const nextRank = (aisles: Aisle[]): number => aisles.reduce((m, a) => Math.max(m, (a.rank ?? 0) + 1), 0);
