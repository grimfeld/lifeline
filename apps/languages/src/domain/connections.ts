import { promptKey } from "./prompts";
import { recallsByPrompt } from "./practice";
import { replay } from "./schedule";
import { fold, leastRecentFirst, type Avoid } from "./puzzle";
import type { Deck, Fact, Puzzle, PuzzleDraw, PuzzleOutcome, Recall, Word } from "./types";

/**
 * Connections (CONTEXT.md "Puzzle", ADR 0106): 16 items to sort into 4 of the
 * Topic's Decks. Pure: what may be drawn, how the groups are built, what a
 * group of four reveals. Never reads a Recall's schedule beyond when it is due.
 */

/** 4 Decks, 4 items from each, 4 mistakes. */
export const GROUPS = 4;
export const GROUP_SIZE = 4;
export const MAX_MISTAKES = 4;

/** A group of four, as kept among a Puzzle's guesses: its item ids. */
const SEP = ",";

/** One item a Connections may draw: a Word's term or a Fact's answer, met in a Practice. */
export interface ConnectionsItem {
  id: string;
  /** What its tile shows: a Word's term, a Fact's answer. */
  answer: string;
  /** What the end shows beside it: a Word's meaning, a Fact's question. */
  clue: string;
}

/**
 * The items a Topic's Connections may draw: Words and Facts in the Topic, not
 * paused, with at least one Recall on any of their Prompts, pass or fail.
 */
export function connectionsItems(topicId: string, words: Word[], facts: Fact[], recalls: Recall[]): Map<string, ConnectionsItem> {
  const met = new Set(recalls.filter((r) => r.languageId === topicId).map((r) => r.itemId));
  const out = new Map<string, ConnectionsItem>();
  for (const w of words) if (w.languageId === topicId && !w.paused && met.has(w.id) && w.term?.trim()) out.set(w.id, { id: w.id, answer: w.term.trim(), clue: w.meaning ?? "" });
  for (const f of facts) if (f.languageId === topicId && !f.paused && met.has(f.id) && f.answer?.trim()) out.set(f.id, { id: f.id, answer: f.answer.trim(), clue: f.question ?? "" });
  return out;
}

function shuffled<T>(xs: T[], random: () => number): T[] {
  const out = [...xs];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Each 4-combination of `n` indices, in order. */
function* fours(n: number): Generator<number[]> {
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) yield [a, b, c, d];
}

/**
 * What each of these Decks keeps once items shared between them are left
 * out — by id, or by a tile that reads the same once folded — so every
 * group has one right answer.
 */
function apart(decks: { deck: Deck; members: ConnectionsItem[] }[]): ConnectionsItem[][] {
  const ids = new Map<string, number>();
  const shown = new Map<string, Set<string>>();
  for (const { deck, members } of decks)
    for (const m of members) {
      ids.set(m.id, (ids.get(m.id) ?? 0) + 1);
      const k = fold(m.answer);
      shown.set(k, (shown.get(k) ?? new Set()).add(deck.id));
    }
  return decks.map(({ members }) => members.filter((m) => ids.get(m.id) === 1 && shown.get(fold(m.answer))!.size === 1));
}

/** `k` of them, drawn toward the Prompt due soonest (the n-th weighted 1/n), `avoid`'s items only when nothing else is left, the least recently drawn first. */
function drawTowardDue(pool: ConnectionsItem[], k: number, dueOf: (id: string) => number, random: () => number, avoid: Avoid): ConnectionsItem[] {
  const rank = (xs: ConnectionsItem[]) => xs.map((x) => ({ x, due: dueOf(x.id) })).sort((a, b) => a.due - b.due || a.x.id.localeCompare(b.x.id)).map((r) => r.x);
  const take = (from: ConnectionsItem[], n: number) => {
    const left = rank(from);
    const out: ConnectionsItem[] = [];
    while (out.length < n && left.length) {
      const weights = left.map((_, i) => 1 / (i + 1));
      let r = random() * weights.reduce((a, b) => a + b, 0);
      let i = 0;
      for (; i < left.length - 1; i++) {
        r -= weights[i]!;
        if (r < 0) break;
      }
      out.push(left.splice(i, 1)[0]!);
    }
    return out;
  };
  const fresh = take(pool.filter((x) => !avoid.has(x.id)), k);
  return [...fresh, ...leastRecentFirst(rank(pool.filter((x) => avoid.has(x.id))), (x) => x.id, avoid).slice(0, k - fresh.length)];
}

/**
 * A Connections' draw: 4 of the Topic's Decks with at least 4 eligible items
 * each once shared items are left out, and 4 from each, in a shuffled order —
 * each kept with its Deck's id and name, so the groups survive the Decks being
 * edited later. Null when no 4 Decks will do.
 */
export function connectionsDraw(topicId: string, decks: Deck[], items: Map<string, ConnectionsItem>, recalls: Recall[], opts: { random: () => number; avoid?: Avoid }): PuzzleDraw[] | null {
  const usable = decks
    .filter((d) => d.languageId === topicId)
    .map((deck) => ({ deck, members: [...new Set(deck.members)].map((id) => items.get(id)).filter((m): m is ConnectionsItem => !!m) }))
    .filter((d) => d.members.length >= GROUP_SIZE)
    .sort((a, b) => a.deck.id.localeCompare(b.deck.id));
  const order = shuffled(usable, opts.random);
  for (const pick of fours(order.length)) {
    const chosen = pick.map((i) => order[i]!);
    const kept = apart(chosen);
    if (kept.some((m) => m.length < GROUP_SIZE)) continue;
    const by = recallsByPrompt(recalls);
    const slots = new Map<string, Set<string>>();
    for (const r of recalls) slots.set(r.itemId, (slots.get(r.itemId) ?? new Set()).add(r.slot));
    const dueOf = (id: string) => Math.min(...[...(slots.get(id) ?? [])].map((s) => replay(by.get(promptKey(id, s)) ?? []).due?.getTime() ?? Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
    const drawn = chosen.flatMap(({ deck }, g) =>
      drawTowardDue(kept[g]!, GROUP_SIZE, dueOf, opts.random, opts.avoid ?? new Map()).map((m): PuzzleDraw => ({ itemId: m.id, slot: "", answer: m.answer, clue: m.clue, hint: "", deckId: deck.id, deck: deck.name })),
    );
    return shuffled(drawn, opts.random);
  }
  return null;
}

/** Which group a drawn item belongs to. */
const groupOf = (d: PuzzleDraw) => d.deckId || d.deck || "";

export interface ConnectionsGroup {
  /** The Deck's name as drawn. */
  deck: string;
  items: PuzzleDraw[];
}

export interface ConnectionsState {
  /** The groups found, in the order found. */
  found: ConnectionsGroup[];
  /** Every group, in the order found and then as drawn: what the end shows. */
  groups: ConnectionsGroup[];
  /** The drawn items not in a found group yet, as drawn. */
  left: PuzzleDraw[];
  mistakes: number;
  /** The last guess was wrong by one item. */
  oneAway: boolean;
}

/** A group of four, as one guess: its item ids. */
export const groupGuess = (ids: readonly string[]) => [...ids].sort().join(SEP);

/** How a Connections stands, read from its guesses. */
export function connectionsState(p: Puzzle): ConnectionsState {
  const byId = new Map(p.drawn.map((d) => [d.itemId, d]));
  const found: ConnectionsGroup[] = [];
  let mistakes = 0;
  let oneAway = false;
  for (const g of p.guesses) {
    const draws = g.split(SEP).map((id) => byId.get(id)).filter((d): d is PuzzleDraw => !!d);
    const counts = new Map<string, number>();
    for (const d of draws) counts.set(groupOf(d), (counts.get(groupOf(d)) ?? 0) + 1);
    const most = Math.max(0, ...counts.values());
    if (draws.length === GROUP_SIZE && most === GROUP_SIZE) {
      found.push({ deck: draws[0]!.deck ?? "", items: p.drawn.filter((d) => groupOf(d) === groupOf(draws[0]!)) });
      oneAway = false;
    } else {
      mistakes++;
      oneAway = most === GROUP_SIZE - 1;
    }
  }
  const done = new Set(found.map((f) => groupOf(f.items[0]!)));
  const rest: ConnectionsGroup[] = [];
  for (const d of p.drawn) {
    if (done.has(groupOf(d))) continue;
    const g = rest.find((r) => groupOf(r.items[0]!) === groupOf(d));
    if (g) g.items.push(d);
    else rest.push({ deck: d.deck ?? "", items: [d] });
  }
  return { found, groups: [...found, ...rest], left: p.drawn.filter((d) => !done.has(groupOf(d))), mistakes, oneAway };
}

/**
 * One group of four submitted: refused unless it is four of the items still
 * left, and not a four already tried. Appended, then the outcome settled —
 * solved with every group found, unsolved on the fourth mistake.
 */
export function settleConnections(p: Puzzle, ids: readonly string[]): { guesses: string[]; outcome: PuzzleOutcome } {
  const left = new Set(connectionsState(p).left.map((d) => d.itemId));
  const picked = new Set(ids);
  if (picked.size !== GROUP_SIZE || ids.length !== GROUP_SIZE || ids.some((id) => !left.has(id))) throw new Error(`Pick ${GROUP_SIZE} of the items left`);
  const guess = groupGuess(ids);
  if (p.guesses.includes(guess)) throw new Error("You already tried those four");
  const guesses = [...p.guesses, guess];
  const after = connectionsState({ ...p, guesses });
  const outcome = after.found.length === GROUPS ? "solved" : after.mistakes >= MAX_MISTAKES ? "unsolved" : "playing";
  return { guesses, outcome };
}
