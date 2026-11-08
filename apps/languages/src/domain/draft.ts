import { FACT, SENTENCE, WORD, type Deck, type Item } from "./types";

/** An agent's draft, not yet accepted (CONTEXT.md "Draft", ADR 0115). */
export const isDraft = (x: { draft?: boolean }): boolean => !!x.draft;

/** In practice: neither paused nor a draft. The one reading Practice, Puzzles and the Due Card share. */
export const inPractice = (x: { paused?: boolean; draft?: boolean }): boolean => !x.paused && !x.draft;

/**
 * Why an outside agent may not edit this item directly, or nothing for a draft (ADR 0115):
 * accepted material changes only through a draft change the user accepts. The user's own
 * edits are never asked.
 */
export function agentEditRefusal(item: object): string | undefined {
  if (isDraft(item as { draft?: boolean })) return undefined;
  return "This is accepted material, which an agent never edits: draft a change with knowledge_draft_change instead, and the user accepts or discards it";
}

/**
 * A draft accepted at `at`: no longer a draft, and added from that moment — so
 * it enters practice as new then, the daily new cap's "oldest added first" and
 * its day's introductions both reading it. Its origin stays (ADR 0115).
 */
export function accepted<T extends Item>(item: T, at: string): T {
  return { ...item, draft: false, addedAt: at };
}

/** The drafts a Deck still holds, in the order they were drafted. */
export function deckDrafts(deck: Deck, items: readonly Item[]): Item[] {
  const ids = new Set(deck.members);
  return items.filter((i) => ids.has(i.id) && isDraft(i)).sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id));
}

/**
 * "Accept all" in a Deck's review (ADR 0115): offered only once every draft left
 * has been shown, so a 30-item lesson is accepted in one go yet each item was seen.
 */
export function acceptAllReady(drafts: readonly { id: string }[], shown: ReadonlySet<string>): boolean {
  return drafts.length > 0 && drafts.every((d) => shown.has(d.id));
}

// ---- Draft changes: an agent's rewrite of accepted material ----

/**
 * Every field an agent may rewrite, with its label: the one list the stored
 * draft change, the Command's arguments, the notice and the checks read.
 * Where it was met stays the drafter's mark, so `origin` is none of them.
 */
export const REWRITABLE_FIELDS: Record<"term" | "meaning" | "text" | "translation" | "question" | "answer" | "notes", { label: string; long: boolean; hint?: string }> = {
  term: { label: "Word", long: false },
  meaning: { label: "Meaning", long: false },
  text: { label: "Sentence", long: true, hint: "keep or change its blanks" },
  translation: { label: "Translation", long: false },
  question: { label: "Question", long: false },
  answer: { label: "Answer", long: true },
  notes: { label: "Notes", long: true },
};

export type RewritableField = keyof typeof REWRITABLE_FIELDS;

/** An agent's draft change (CONTEXT.md "Draft"): the fields of an accepted item it would rewrite, each as the text it would become. */
export type DraftChange = Partial<Record<RewritableField, string>>;

/** Which of those fields each kind of item has (ADR 0115). */
export const REWRITABLE: Record<Item["type"], readonly RewritableField[]> = {
  [WORD]: ["term", "meaning", "notes"],
  [SENTENCE]: ["text", "translation", "notes"],
  [FACT]: ["question", "answer", "notes"],
};

/** The kind of item, as a sentence names it. */
export const KIND_NAME: Record<Item["type"], string> = { [WORD]: "Word", [SENTENCE]: "Sentence", [FACT]: "Fact" };

/** What the item would read after its draft change: only the fields that really differ, so the change shows beside current values. */
export function draftChangeLines(item: Item): { key: RewritableField; current: string; drafted: string }[] {
  const change = item.draftChange;
  if (!change) return [];
  const own = item as unknown as Record<string, string>;
  return REWRITABLE[item.type].flatMap((key) => (change[key] !== undefined && change[key] !== own[key] ? [{ key, current: own[key] ?? "", drafted: change[key]! }] : []));
}

/** The kinds that have a field, as a sentence names them: "Word", "Word, Sentence or Fact". */
export function kindsWith(field: RewritableField): string {
  const names = (Object.keys(REWRITABLE) as Item["type"][]).filter((t) => REWRITABLE[t].includes(field)).map((t) => KIND_NAME[t]);
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} or ${names.at(-1)}` : (names[0] ?? "");
}
