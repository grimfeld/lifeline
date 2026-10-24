import { todayStr } from "@lifeline/core";
import { parseCloze } from "./cloze";
import { promptKey } from "./prompts";
import { recallsByPrompt } from "./practice";
import { replay } from "./schedule";
import { SENTENCE, type Puzzle, type PuzzleDraw, type Recall, type Sentence, type Word } from "./types";

/**
 * Puzzles (CONTEXT.md "Puzzle", ADR 0106): word puzzles over material already
 * kept and already met in a Practice. Pure: what may be drawn, what a guess
 * reveals, how a Puzzle stands. Nothing here reads or writes a Recall's
 * schedule — a Puzzle only looks at which Prompts were met.
 */

/** A Wordle-like gives this many guesses. */
export const MAX_GUESSES = 6;

/** A Wordle-like's term, after folding: one word of this many letters. */
export const WORDLE_MIN = 4;
export const WORDLE_MAX = 10;

/**
 * Matching folds case and accents: "Árbol" is "arbol", and ñ is n — unless the
 * Topic keeps ñ as its own letter (`enye`). What is shown keeps the stored spelling.
 */
export function fold(s: string, enye = false): string {
  const base = (c: string) => c.normalize("NFD").replace(/\p{M}+/gu, "").toLocaleLowerCase();
  if (!enye) return base(s);
  return Array.from(s.normalize("NFC"), (c) => (c.toLocaleLowerCase() === "ñ" ? "ñ" : base(c))).join("");
}

/** A word's letters as written, one per cell — or null when one of them is not a single letter once folded. */
export function lettersOf(word: string): string[] | null {
  const chars = Array.from(word.trim().normalize("NFC"));
  return chars.every((c) => /^\p{L}$/u.test(fold(c))) ? chars : null;
}

/** A Word's term as a Wordle-like answer: one word of 4–10 letters after folding, else null. */
export function wordleLetters(term: string): string[] | null {
  const letters = lettersOf(term);
  return letters && letters.length >= WORDLE_MIN && letters.length <= WORDLE_MAX ? letters : null;
}

/**
 * The Words a Topic's Wordle-like may draw: in the Topic, not paused, met
 * reversed at least once (a pass or a fail), with a term of the right shape.
 */
export function wordleCandidates(topicId: string, words: Word[], recalls: Recall[]): Word[] {
  const met = new Set(recalls.filter((r) => r.languageId === topicId && r.slot === "reverse").map((r) => r.itemId));
  return words.filter((w) => w.languageId === topicId && !w.paused && met.has(w.id) && wordleLetters(w.term) !== null);
}

/**
 * What recent Puzzles drew: each item id with when a Puzzle of it was last opened or played. A
 * draw leaves these out where anything else remains; once nothing else does,
 * the least recently drawn comes first.
 */
export type Avoid = ReadonlyMap<string, string>;

/** The items these Puzzles drew, each with the latest of their `updatedAt` (an ISO instant: when last opened or played). */
export function drawnBy(puzzles: Puzzle[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of puzzles) for (const d of p.drawn) if ((out.get(d.itemId) ?? "") < (p.updatedAt ?? "")) out.set(d.itemId, p.updatedAt ?? "");
  return out;
}

/** `xs` that `avoid` holds, least recently drawn first (stable otherwise). */
export function leastRecentFirst<T>(xs: T[], idOf: (x: T) => string, avoid: Avoid): T[] {
  return [...xs].sort((a, b) => (avoid.get(idOf(a)) ?? "").localeCompare(avoid.get(idOf(b)) ?? ""));
}

/**
 * Pick one, drawn toward the Prompt due soonest: candidates ranked by when
 * their reverse Prompt is due, the n-th weighted 1/n — so what is about to
 * be forgotten comes most often, without the same Word every day while it
 * waits. `avoid`'s items are left out where anything else remains.
 */
export function pickTowardDue(candidates: Word[], recalls: Recall[], opts: { random: () => number; avoid?: Avoid }): Word | undefined {
  const by = recallsByPrompt(recalls);
  const dueOf = (w: Word) => replay(by.get(promptKey(w.id, "reverse")) ?? []).due?.getTime() ?? Number.POSITIVE_INFINITY;
  const rank = (ws: Word[]) => ws.map((w) => ({ w, due: dueOf(w) })).sort((a, b) => a.due - b.due || a.w.id.localeCompare(b.w.id));
  const pool = candidates.filter((w) => !opts.avoid?.has(w.id));
  if (!pool.length) return leastRecentFirst(rank(candidates), (x) => x.w.id, opts.avoid ?? new Map())[0]?.w;
  const ranked = rank(pool);
  const weights = ranked.map((_, i) => 1 / (i + 1));
  let r = opts.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ranked.length; i++) {
    r -= weights[i]!;
    if (r < 0) return ranked[i]!.w;
  }
  return ranked[ranked.length - 1]?.w;
}

/** What a Wordle-like draws from a Word: its term, its meaning, and a Sentence's translation where the term is one of its blanks. */
export function wordleDraw(word: Word, sentences: Sentence[], enye = false): PuzzleDraw {
  const term = fold(word.term.trim(), enye);
  const sentence = sentences
    .filter((s) => s.type === SENTENCE && s.languageId === word.languageId && !s.paused && s.translation?.trim())
    .sort((a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? "") || a.id.localeCompare(b.id))
    .find((s) => parseCloze(s.text ?? "").some((p) => p.kind === "blank" && fold(p.text, enye) === term));
  return { itemId: word.id, slot: "reverse", answer: word.term.trim(), clue: word.meaning, hint: sentence?.translation.trim() ?? "" };
}

export type Mark = "right" | "present" | "absent";

/** One guess against the answer, letter by letter: a repeated letter is marked only as often as the answer holds it. */
export function scoreGuess(answer: string, guess: string, enye = false): Mark[] {
  const a = Array.from(fold(answer.normalize("NFC"), enye));
  const g = Array.from(fold(guess.normalize("NFC"), enye));
  const marks: Mark[] = g.map((c, i) => (c === a[i] ? "right" : "absent"));
  const left = new Map<string, number>();
  a.forEach((c, i) => {
    if (marks[i] !== "right") left.set(c, (left.get(c) ?? 0) + 1);
  });
  g.forEach((c, i) => {
    if (marks[i] === "right") return;
    const n = left.get(c) ?? 0;
    if (n > 0) {
      marks[i] = "present";
      left.set(c, n - 1);
    }
  });
  return marks;
}

export interface Cell {
  /** The letter as typed, or the answer's own spelling where it is in the right place. */
  letter: string;
  mark: Mark;
}

/** A Wordle-like's guesses as its grid shows them, oldest first. */
export function wordleRows(p: Puzzle, enye = false): Cell[][] {
  const answer = p.drawn[0]?.answer ?? "";
  const shown = lettersOf(answer) ?? [];
  return p.guesses.map((g) => {
    const typed = lettersOf(g) ?? Array.from(g);
    return scoreGuess(answer, g, enye).map((mark, i) => ({ letter: (mark === "right" ? shown[i] : undefined) ?? typed[i] ?? "", mark }));
  });
}

/** Whether a guess is the answer, folded. */
export function isAnswer(answer: string, guess: string, enye = false): boolean {
  return fold(answer.normalize("NFC"), enye) === fold(guess.trim().normalize("NFC"), enye);
}

/**
 * The on-screen keyboard's letters: the folded letters of a Topic's kept terms
 * (plus `extra`, such as the answer's and the guesses'), once each, in
 * alphabetical order — ñ after n when it is its own letter.
 */
export function keyboardLetters(terms: string[], enye: boolean, extra: string[] = []): string[] {
  const seen = new Set<string>();
  for (const t of [...terms, ...extra]) for (const c of Array.from(fold(t, enye))) if (/^\p{L}$/u.test(c)) seen.add(c);
  return [...seen].sort((a, b) => a.localeCompare(b, "es"));
}

const RANK: Record<Mark, number> = { absent: 0, present: 1, right: 2 };

/** What the guesses so far revealed of each (folded) letter: the best mark any guess gave it. A letter not yet tried is absent from the map. */
export function letterMarks(answer: string, guesses: string[], enye = false): Map<string, Mark> {
  const out = new Map<string, Mark>();
  for (const g of guesses) {
    const letters = Array.from(fold(g.trim().normalize("NFC"), enye));
    scoreGuess(answer, g, enye).forEach((mark, i) => {
      const c = letters[i];
      if (c !== undefined && RANK[mark] >= (out.has(c) ? RANK[out.get(c)!] : -1)) out.set(c, mark);
    });
  }
  return out;
}

/** How a Puzzle stands now: a daily still playing from an earlier day is unsolved — "daily" means daily. */
export function outcomeAt(p: Puzzle, now: Date) {
  return p.kind === "daily" && p.outcome === "playing" && p.day < todayStr(now) ? "unsolved" : p.outcome;
}
