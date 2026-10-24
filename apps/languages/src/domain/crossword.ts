import { parseCloze } from "./cloze";
import { recallsByPrompt } from "./practice";
import { promptKey } from "./prompts";
import { fold, leastRecentFirst, lettersOf, type Avoid } from "./puzzle";
import { replay } from "./schedule";
import { FACT, SENTENCE, WORD, type Fact, type Puzzle, type PuzzleDraw, type Recall, type Sentence, type Word } from "./types";

/**
 * The crossword's grid (ADR 0106): a free-form layout of 5–8 crossing
 * answers, as small as a phone shows. Pure and deterministic — the same
 * answers in the same order give the same grid — so a Puzzle can store it
 * and a test can pin it. Letters come in folded, so a crossing only needs
 * the same letter after folding (á crosses a).
 */

export const CROSSWORD_MIN = 5;
export const CROSSWORD_MAX = 8;

export type Direction = "across" | "down";

/** Where one answer sits: its first cell and which way it runs. */
export interface Placement {
  row: number;
  col: number;
  dir: Direction;
}

/** A placement of the pool's `index`-th answer. */
export interface Placed extends Placement {
  index: number;
}

/** The cells an answer of `length` letters fills, first to last, as [row, col]. */
export function cellsOf(p: Placement, length: number): [number, number][] {
  return Array.from({ length }, (_, i) => (p.dir === "across" ? [p.row, p.col + i] : [p.row + i, p.col]));
}

const key = (r: number, c: number) => `${r},${c}`;

interface Grid {
  cells: Map<string, string>;
  /** Which way each filled cell runs, to know when two answers lie along each other. */
  dirs: Map<string, Set<Direction>>;
  placed: Placed[];
  /** Each pool answer's length, by index. */
  lengths: number[];
  rows: [number, number];
  cols: [number, number];
}

function put(g: Grid, p: Placed, letters: string[]): void {
  cellsOf(p, letters.length).forEach(([r, c], i) => {
    const k = key(r, c);
    g.cells.set(k, letters[i]!);
    g.dirs.set(k, (g.dirs.get(k) ?? new Set()).add(p.dir));
    g.rows = [Math.min(g.rows[0], r), Math.max(g.rows[1], r)];
    g.cols = [Math.min(g.cols[0], c), Math.max(g.cols[1], c)];
  });
  g.placed.push(p);
}

/**
 * How many cells `p` would share with the grid, or -1 when it can't go
 * there: a cell holding another letter, a cell already run the same way,
 * an answer running straight on into another, or a letter touching one
 * beside it that it doesn't cross.
 */
function fit(g: Grid, p: Placement, letters: string[]): number {
  const cells = cellsOf(p, letters.length);
  const [dr, dc] = p.dir === "across" ? [0, 1] : [1, 0];
  const [first, last] = [cells[0]!, cells[cells.length - 1]!];
  if (g.cells.has(key(first[0] - dr, first[1] - dc)) || g.cells.has(key(last[0] + dr, last[1] + dc))) return -1;
  let crossings = 0;
  for (let i = 0; i < cells.length; i++) {
    const [r, c] = cells[i]!;
    const k = key(r, c);
    const there = g.cells.get(k);
    if (there !== undefined) {
      if (there !== letters[i] || g.dirs.get(k)!.has(p.dir)) return -1;
      crossings++;
      continue;
    }
    if (g.cells.has(key(r + dc, c + dr)) || g.cells.has(key(r - dc, c - dr))) return -1;
  }
  return crossings;
}

const area = (g: Grid, p: Placement, length: number) => {
  const [r1, c1] = p.dir === "across" ? [p.row, p.col + length - 1] : [p.row + length - 1, p.col];
  return (Math.max(g.rows[1], r1) - Math.min(g.rows[0], p.row) + 1) * (Math.max(g.cols[1], c1) - Math.min(g.cols[0], p.col) + 1);
};

/** The best place for an answer: most crossings, then the smallest grid, then the first found. */
function bestPlace(g: Grid, letters: string[]): Placement | null {
  let best: { p: Placement; crossings: number; area: number } | null = null;
  for (const at of g.placed) {
    const dir: Direction = at.dir === "across" ? "down" : "across";
    for (const [r, c] of cellsOf(at, g.lengths[at.index]!)) {
      const letter = g.cells.get(key(r, c));
      letters.forEach((l, j) => {
        if (l !== letter) return;
        const p: Placement = dir === "across" ? { row: r, col: c - j, dir } : { row: r - j, col: c, dir };
        const crossings = fit(g, p, letters);
        if (crossings < 1) return;
        const a = area(g, p, letters.length);
        if (!best || crossings > best.crossings || (crossings === best.crossings && a < best.area)) best = { p, crossings, area: a };
      });
    }
  }
  return (best as { p: Placement } | null)?.p ?? null;
}

/** Grow a grid from one seed answer, taking the rest in order, pass after pass, until nothing more fits. */
function grow(words: string[][], seed: number, max: number): Placed[] {
  const g: Grid = { cells: new Map(), dirs: new Map(), placed: [], lengths: words.map((w) => w.length), rows: [0, 0], cols: [0, 0] };
  put(g, { index: seed, row: 0, col: 0, dir: "across" }, words[seed]!);
  const left = words.map((_, i) => i).filter((i) => i !== seed);
  let progress = true;
  while (progress && g.placed.length < max) {
    progress = false;
    for (const i of [...left]) {
      if (g.placed.length >= max) break;
      const p = bestPlace(g, words[i]!);
      if (!p) continue;
      put(g, { index: i, ...p }, words[i]!);
      left.splice(left.indexOf(i), 1);
      progress = true;
    }
  }
  return g.placed;
}

/**
 * Lay out a crossword from a pool of answers (each its folded letters):
 * 5–8 of them, all crossing into one grid, preferring the pool's first
 * answers and the most crossings. Every answer is tried as the seed until
 * one grows to the most; an answer that crosses nothing is left out. Null
 * when fewer than `min` fit. Placements come in the order they were laid,
 * shifted so the grid starts at row 0, column 0.
 */
export function layoutCrossword(words: string[][], opts: { min?: number; max?: number } = {}): Placed[] | null {
  const min = opts.min ?? CROSSWORD_MIN;
  const max = opts.max ?? CROSSWORD_MAX;
  let best: Placed[] = [];
  for (let seed = 0; seed < words.length && best.length < max; seed++) {
    if (!words[seed]!.length) continue;
    const placed = grow(words, seed, max);
    if (placed.length > best.length) best = placed;
  }
  if (best.length < min) return null;
  const top = Math.min(...best.map((p) => p.row));
  const left = Math.min(...best.map((p) => p.col));
  return best.map((p) => ({ index: p.index, row: p.row - top, col: p.col - left, dir: p.dir }));
}

// ---- What a crossword draws ----

/** A crossword answer: one word of this many letters, folded. */
export const CROSS_MIN_LETTERS = 3;
export const CROSS_MAX_LETTERS = 12;

/** The pool a layout is tried on: the first this many, toward what is due. */
const POOL = 24;

/** An answer's letters as written, when it is one word of 3–12; else null. */
export function crosswordLetters(answer: string): string[] | null {
  const letters = lettersOf(answer);
  return letters && letters.length >= CROSS_MIN_LETTERS && letters.length <= CROSS_MAX_LETTERS ? letters : null;
}

/** A Sentence with one blank left open and the others filled: the clue for that blank. */
function blankClue(text: string, slot: string): string {
  return parseCloze(text)
    .map((p) => (p.kind === "blank" && p.slot === slot ? "___" : p.text))
    .join("");
}

/**
 * Everything a Topic's crossword may draw (ADR 0106), in a fixed order:
 * Word terms (clue: the meaning, Prompt: reverse), single-word Fact answers
 * (clue: the question) and Sentence blanks (clue: the Sentence with that
 * blank open, hint: its translation) — each in the Topic, not paused, its
 * Prompt met at least once, one word of 3–12 letters. Two answers the same
 * once folded are drawn once, the first kept.
 */
export function crosswordDraws(topicId: string, items: { words: Word[]; sentences: Sentence[]; facts: Fact[] }, recalls: Recall[], enye = false): PuzzleDraw[] {
  const met = new Set(recalls.filter((r) => r.languageId === topicId).map((r) => promptKey(r.itemId, r.slot)));
  const live = <T extends { languageId: string; paused: boolean; addedAt?: string; id: string }>(xs: T[]) =>
    xs.filter((x) => x.languageId === topicId && !x.paused).sort((a, b) => (a.addedAt ?? "").localeCompare(b.addedAt ?? "") || a.id.localeCompare(b.id));
  const out: PuzzleDraw[] = [];
  for (const w of live(items.words)) if (w.type === WORD) out.push({ itemId: w.id, slot: "reverse", answer: (w.term ?? "").trim(), clue: w.meaning, hint: "" });
  for (const f of live(items.facts)) if (f.type === FACT) out.push({ itemId: f.id, slot: "forward", answer: (f.answer ?? "").trim(), clue: f.question, hint: "" });
  for (const s of live(items.sentences)) {
    if (s.type !== SENTENCE) continue;
    for (const part of parseCloze(s.text ?? "")) {
      if (part.kind === "blank") out.push({ itemId: s.id, slot: part.slot, answer: part.text.trim(), clue: blankClue(s.text, part.slot), hint: s.translation?.trim() ?? "" });
    }
  }
  const seen = new Set<string>();
  return out.filter((d) => {
    if (!met.has(promptKey(d.itemId, d.slot)) || !crosswordLetters(d.answer)) return false;
    const k = fold(d.answer, enye);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * The draws in the order a layout should prefer them: toward the Prompt due
 * soonest, each next pick weighted 1/rank among those left (so not the same
 * grid every day), `avoid`'s items last, the least recently drawn first.
 * With `random` always 0 and nothing to avoid it is simply the due order,
 * ties by the folded answer, then the item: never by anything random, such
 * as an id alone, so the same material always lays out the same.
 */
export function orderTowardDue(draws: PuzzleDraw[], recalls: Recall[], opts: { random: () => number; avoid?: Avoid }): PuzzleDraw[] {
  const by = recallsByPrompt(recalls);
  const dueOf = (d: PuzzleDraw) => replay(by.get(promptKey(d.itemId, d.slot)) ?? []).due?.getTime() ?? Number.POSITIVE_INFINITY;
  const rank = (xs: PuzzleDraw[]) =>
    xs
      .map((d) => ({ d, due: dueOf(d) }))
      .sort((a, b) => a.due - b.due || fold(a.d.answer).localeCompare(fold(b.d.answer)) || a.d.itemId.localeCompare(b.d.itemId) || a.d.slot.localeCompare(b.d.slot))
      .map((x) => x.d);
  const draw = (xs: PuzzleDraw[]) => {
    const left = rank(xs);
    const out: PuzzleDraw[] = [];
    while (left.length) {
      const weights = left.map((_, i) => 1 / (i + 1));
      let r = opts.random() * weights.reduce((a, b) => a + b, 0);
      let at = left.length - 1;
      for (let i = 0; i < left.length; i++) {
        r -= weights[i]!;
        if (r < 0) {
          at = i;
          break;
        }
      }
      out.push(...left.splice(at, 1));
    }
    return out;
  };
  const avoid = opts.avoid ?? new Map<string, string>();
  return [...draw(draws.filter((d) => !avoid.has(d.itemId))), ...leastRecentFirst(rank(draws.filter((d) => avoid.has(d.itemId))), (d) => d.itemId, avoid)];
}

/**
 * A crossword built from draws: laid out in `order`, else in `fallback`
 * (plain due order) should that fail. What it drew and where each sits,
 * side by side; null when fewer than five cross.
 */
export function buildCrossword(order: PuzzleDraw[], fallback: PuzzleDraw[], enye = false): { drawn: PuzzleDraw[]; layout: Placement[] } | null {
  for (const pool of [order, fallback]) {
    const head = pool.slice(0, POOL);
    const placed = layoutCrossword(head.map((d) => Array.from(fold(d.answer.normalize("NFC"), enye))));
    if (placed) return { drawn: placed.map((p) => head[p.index]!), layout: placed.map(({ row, col, dir }) => ({ row, col, dir })) };
  }
  return null;
}

// ---- Playing it ----

export interface CrosswordCell {
  row: number;
  col: number;
  /** The answer's letter in its stored spelling. */
  letter: string;
  /** What the player typed there, empty for nothing yet. */
  entry: string;
}

/** A crossword's cell entry, kept as one guess: "row,col:letter", an empty letter clearing the cell. */
export const entryGuess = (row: number, col: number, letter: string) => `${row},${col}:${letter}`;

const ENTRY = /^(-?\d+),(-?\d+):(.*)$/su;

function entriesOf(guesses: string[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const g of guesses) {
    const m = ENTRY.exec(g);
    if (m) out.set(key(Number(m[1]), Number(m[2])), m[3]!);
  }
  return out;
}

/** The crossword's cells in reading order, each with its letter and what stands entered there now. */
export function crosswordCells(p: Puzzle): CrosswordCell[] {
  const layout = p.layout ?? [];
  const entries = entriesOf(p.guesses);
  const cells = new Map<string, CrosswordCell>();
  p.drawn.forEach((d, i) => {
    const at = layout[i];
    const letters = lettersOf(d.answer);
    if (!at || !letters) return;
    cellsOf(at, letters.length).forEach(([row, col], j) => {
      const k = key(row, col);
      if (!cells.has(k)) cells.set(k, { row, col, letter: letters[j]!, entry: entries.get(k) ?? "" });
    });
  });
  return [...cells.values()].sort((a, b) => a.row - b.row || a.col - b.col);
}

/** Solved: every cell holds its letter, folded. */
export function crosswordSolved(p: Puzzle, enye = false): boolean {
  const cells = crosswordCells(p);
  return cells.length > 0 && cells.every((c) => c.entry !== "" && fold(c.entry, enye) === fold(c.letter, enye));
}

export interface CrosswordClue {
  /** The grid's number at its first cell, shared by an across and a down starting together. */
  number: number;
  dir: Direction;
  draw: PuzzleDraw;
  at: Placement;
  /** Its cells, first to last, as [row, col]. */
  cells: [number, number][];
}

/** The clues, numbered as a crossword numbers them (first cells in reading order), across first, then down. */
export function crosswordClues(p: Puzzle): CrosswordClue[] {
  const layout = p.layout ?? [];
  const items = p.drawn.flatMap((draw, i) => {
    const at = layout[i];
    const letters = lettersOf(draw.answer);
    return at && letters ? [{ draw, at, cells: cellsOf(at, letters.length) }] : [];
  });
  const starts = [...new Set(items.map((x) => key(x.at.row, x.at.col)))].map((k) => k.split(",").map(Number) as [number, number]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const numberOf = new Map(starts.map(([r, c], i) => [key(r, c), i + 1]));
  return items
    .map((x) => ({ ...x, dir: x.at.dir, number: numberOf.get(key(x.at.row, x.at.col))! }))
    .sort((a, b) => (a.dir === b.dir ? a.number - b.number : a.dir === "across" ? -1 : 1));
}
