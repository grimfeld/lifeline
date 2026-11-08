import { FACT, SENTENCE, WORD, type Item, type Proposal } from "./types";

/** An agent's draft, not yet accepted (CONTEXT.md "Draft", ADR 0115). */
export const isDraft = (x: { draft?: boolean }): boolean => !!x.draft;

/** In practice: neither paused nor a draft. The one reading Practice, Puzzles and the Due Card share. */
export const kept = (x: { paused?: boolean; draft?: boolean }): boolean => !x.paused && !x.draft;

/**
 * A draft accepted at `at`: no longer a draft, and added from that moment — so
 * it enters practice as new then, the daily new cap's "oldest added first" and
 * its day's introductions both reading it. Its origin stays (ADR 0115).
 */
export function accepted<T extends Item>(item: T, at: string): T {
  return { ...item, draft: false, addedAt: at };
}

/** The fields an agent may propose to rewrite, per kind of item (ADR 0115). Where it was met stays the drafter's mark. */
export const REWRITABLE: Record<Item["type"], readonly (keyof Proposal)[]> = {
  [WORD]: ["term", "meaning", "notes"],
  [SENTENCE]: ["text", "translation", "notes"],
  [FACT]: ["question", "answer", "notes"],
};

/** What the item would read after its pending change: only the fields that really differ, so a proposal beside current values shows just the change. */
export function proposedChanges(item: Item): { key: keyof Proposal; current: string; proposed: string }[] {
  const p = item.proposal;
  if (!p) return [];
  const own = item as unknown as Record<string, string>;
  return REWRITABLE[item.type].flatMap((key) => (p[key] !== undefined && p[key] !== own[key] ? [{ key, current: own[key] ?? "", proposed: p[key]! }] : []));
}

/**
 * "Accept all" in a Deck's review (ADR 0115): offered only once every draft still
 * pending has been shown, so a 30-item lesson is accepted in one go yet each item was seen.
 */
export function acceptAllReady(pending: readonly { id: string }[], shown: ReadonlySet<string>): boolean {
  return pending.length > 0 && pending.every((d) => shown.has(d.id));
}
