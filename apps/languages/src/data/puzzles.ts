import { useMemo } from "react";
import { addDays, documentsOf, documentsWhere, getDocument, putDocument, todayStr, useDocuments, type DateStr } from "@lifeline/core";
import { lettersOf, MAX_GUESSES, isAnswer, outcomeAt, pickTowardDue, wordleCandidates, wordleDraw } from "../domain/puzzle";
import { buildCrossword, crosswordCells, crosswordDraws, crosswordSolved, entryGuess, orderTowardDue, type Placement } from "../domain/crossword";
import { FACT, PUZZLE, RECALL, SENTENCE, TOPIC, WORD, type Fact, type Puzzle, type PuzzleDraw, type PuzzleFormat, type Recall, type Sentence, type Topic, type Word } from "../domain/types";

/**
 * Puzzles' data (CONTEXT.md "Puzzle", ADR 0106). Nothing here writes a
 * Recall, or calls anything that does: playing never moves the schedule.
 */

/** The formats built so far; Connections joins later. */
export const PUZZLE_FORMATS = ["wordle", "crossword"] as const satisfies readonly PuzzleFormat[];

/** A recent daily's Word is drawn again only when nothing else is left. */
const AVOID_DAYS = 7;

// ---- Shapes on read: PocketBase returns absent fields as "" / undefined ----

function normalizeDraw(d: unknown): PuzzleDraw | null {
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  return str("answer") ? { itemId: str("itemId"), slot: str("slot"), answer: str("answer"), clue: str("clue"), hint: str("hint") } : null;
}

function normalizeLayout(l: unknown): Placement[] | undefined {
  if (!Array.isArray(l)) return undefined;
  return l.map((x) => {
    const r = (x ?? {}) as Record<string, unknown>;
    return { row: Number(r.row) || 0, col: Number(r.col) || 0, dir: r.dir === "down" ? "down" : "across" };
  });
}

/** Read as it stands at `now`: a daily left playing past midnight reads unsolved. */
export function normalizePuzzle(p: Puzzle, now: Date = new Date()): Puzzle {
  const drawn = Array.isArray(p.drawn) ? p.drawn.map(normalizeDraw).filter((d): d is PuzzleDraw => d !== null) : [];
  const guesses = Array.isArray(p.guesses) ? p.guesses.filter((g): g is string => typeof g === "string") : [];
  const outcome = p.outcome === "solved" || p.outcome === "unsolved" ? p.outcome : "playing";
  const read: Puzzle = { ...p, languageId: p.languageId ?? "", format: p.format || "wordle", kind: p.kind === "replay" ? "replay" : "daily", day: p.day || "", drawn, guesses, outcome, finishedAt: p.finishedAt || "", tags: p.tags ?? [] };
  const layout = normalizeLayout(p.layout);
  if (layout) read.layout = layout;
  return { ...read, outcome: outcomeAt(read, now) };
}

/** A Puzzle that drew nothing is no Puzzle: never offered, never played. */
const playable = (p: Puzzle) => p.drawn.length > 0;

function dailyOf(puzzles: Puzzle[], topicId: string, format: PuzzleFormat, day: DateStr): Puzzle | undefined {
  // Two devices may each have opened one before syncing: the first made stands for both.
  return puzzles.filter((p) => p.languageId === topicId && p.format === format && p.kind === "daily" && p.day === day && playable(p)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
}

/** Work on one key, one after another — two quick opens make one Puzzle, two quick guesses both count. */
const queues = new Map<string, Promise<unknown>>();
function serially<T>(key: string, work: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(work);
  queues.set(key, next);
  void next.finally(() => {
    if (queues.get(key) === next) queues.delete(key);
  }).catch(() => undefined);
  return next;
}

async function topicPuzzles(topicId: string, now: Date): Promise<Puzzle[]> {
  return (await documentsWhere<Puzzle>(PUZZLE, "languageId", topicId)).map((p) => normalizePuzzle(p, now));
}

// ---- Reads ----

export async function getPuzzle(id: string, now: Date = new Date()): Promise<Puzzle | undefined> {
  const p = await getDocument<Puzzle>(id);
  return p && p.type === PUZZLE ? normalizePuzzle(p, now) : undefined;
}

export interface TodaysPuzzle {
  topic: Topic;
  format: PuzzleFormat;
  /** Today's daily, once opened; null while there is something to draw and it is not opened yet. */
  puzzle: Puzzle | null;
}

/**
 * Today's Puzzles across the active Topics: each format a Topic can build,
 * or has already built today. An archived Topic, and a format with nothing
 * to draw, has none.
 */
export function todayOf(topics: Topic[], words: Word[], recalls: Recall[], puzzles: Puzzle[], now: Date, more: { sentences?: Sentence[]; facts?: Fact[] } = {}): TodaysPuzzle[] {
  const day = todayStr(now);
  const out: TodaysPuzzle[] = [];
  for (const topic of topics) {
    if (topic.archived) continue;
    for (const format of PUZZLE_FORMATS) {
      const puzzle = dailyOf(puzzles, topic.id, format, day) ?? null;
      if (puzzle || canBuild(format, topic, { words, sentences: more.sentences ?? [], facts: more.facts ?? [] }, recalls)) out.push({ topic, format, puzzle });
    }
  }
  return out;
}

/** Whether a Topic has enough to build a format from: a Wordle-like one Word, a crossword five answers that cross. */
function canBuild(format: PuzzleFormat, topic: Topic, items: { words: Word[]; sentences: Sentence[]; facts: Fact[] }, recalls: Recall[]): boolean {
  if (format === "wordle") return wordleCandidates(topic.id, items.words, recalls).length > 0;
  if (format === "crossword") return drawCrossword(topic, items, recalls, () => 0, new Set()) !== null;
  return false;
}

export async function todaysPuzzles(now: Date = new Date()): Promise<TodaysPuzzle[]> {
  const [topics, words, recalls, puzzles, sentences, facts] = await Promise.all([documentsOf<Topic>(TOPIC), documentsOf<Word>(WORD), documentsOf<Recall>(RECALL), documentsOf<Puzzle>(PUZZLE), documentsOf<Sentence>(SENTENCE), documentsOf<Fact>(FACT)]);
  return todayOf(topics.map((t) => ({ ...t, archived: !!t.archived })), words.map((w) => ({ ...w, paused: !!w.paused })), recalls, puzzles.map((p) => normalizePuzzle(p, now)), now, { sentences: sentences.map((x) => ({ ...x, paused: !!x.paused })), facts: facts.map((x) => ({ ...x, paused: !!x.paused })) });
}

/** Every Puzzle, live, read as it stands now. */
export function usePuzzles(now: Date): Puzzle[] {
  const rows = useDocuments<Puzzle>(PUZZLE);
  return useMemo(() => rows.map((p) => normalizePuzzle(p, now)), [rows, now]);
}

/** A format as the user reads it. */
export const FORMAT_LABEL: Record<PuzzleFormat, string> = { wordle: "Wordle-like", crossword: "Crossword", connections: "Connections" };

/** "Wordle-like · solved in 4", "Wordle-like · 2 of 6 guesses" — how a Puzzle stands, in a line. */
export function puzzleLine(p: Puzzle): string {
  const what = FORMAT_LABEL[p.format] ?? p.format;
  if (p.format === "crossword") {
    if (p.outcome !== "playing") return `${what} · ${p.outcome}`;
    const cells = crosswordCells(p);
    return `${what} · ${cells.filter((c) => c.entry).length} of ${cells.length} letters`;
  }
  if (p.outcome === "solved") return `${what} · solved in ${p.guesses.length}`;
  if (p.outcome === "unsolved") return `${what} · unsolved`;
  return `${what} · ${p.guesses.length} of ${MAX_GUESSES} guesses`;
}

// ---- Writes ----

/**
 * Today's daily Puzzle of a format for a Topic: the one already opened today,
 * else a new one drawn now and fixed by writing it — so Words added later
 * change nothing. Null when the Topic is archived or has nothing to draw.
 */
export function openDailyPuzzle(topicId: string, format: PuzzleFormat, opts: { now?: Date; random?: () => number } = {}): Promise<Puzzle | null> {
  const now = opts.now ?? new Date();
  const day = todayStr(now);
  return serially(`open|${topicId}|${format}|${day}`, async () => {
    const topic = await getDocument<Topic>(topicId);
    if (!topic || topic.type !== TOPIC || topic.archived) return null;
    const mine = await topicPuzzles(topicId, now);
    const existing = dailyOf(mine, topicId, format, day);
    if (existing) return existing;
    if (format === "crossword") {
      const since = addDays(day, -AVOID_DAYS);
      const avoid = new Set(mine.filter((p) => p.format === format && p.kind === "daily" && p.day >= since).flatMap((p) => p.drawn.map((d) => d.itemId)));
      return putCrossword(topic, "daily", day, avoid, opts.random ?? Math.random, now);
    }
    if (format !== "wordle") return null;
    const [words, recalls, sentences] = await Promise.all([documentsWhere<Word>(WORD, "languageId", topicId), documentsWhere<Recall>(RECALL, "languageId", topicId), documentsWhere<Sentence>(SENTENCE, "languageId", topicId)]);
    const since = addDays(day, -AVOID_DAYS);
    const avoid = new Set(mine.filter((p) => p.format === format && p.kind === "daily" && p.day >= since).flatMap((p) => p.drawn.map((d) => d.itemId)));
    const word = pickTowardDue(wordleCandidates(topicId, words.map((w) => ({ ...w, paused: !!w.paused })), recalls), recalls, { random: opts.random ?? Math.random, avoid });
    if (!word) return null;
    const row = await putDocument<Puzzle>({ type: PUZZLE, title: `${topic.title} · Wordle-like · ${day}`, languageId: topicId, format, kind: "daily", day, drawn: [wordleDraw(word, sentences, !!topic.enyeOwn)], guesses: [], outcome: "playing", finishedAt: "", folder: "", tags: [] });
    return normalizePuzzle(row, now);
  });
}

/** Read for a write: refuses a Puzzle that is finished, or a daily whose day is over. */
async function playing(id: string, now: Date): Promise<Puzzle> {
  const p = await getPuzzle(id, now);
  if (!p || !playable(p)) throw new Error("That puzzle no longer exists");
  if (p.kind === "daily" && p.day < todayStr(now)) throw new Error("This daily puzzle ended at midnight");
  if (p.outcome !== "playing") throw new Error("This puzzle is already finished");
  return p;
}

/**
 * One guess at a Wordle-like: any word of the answer's length, no dictionary.
 * Appended, then the outcome settled — solved, or unsolved on the sixth miss.
 */
export function guessPuzzle(id: string, guess: string, now: Date = new Date()): Promise<Puzzle> {
  return serially(`play|${id}`, async () => {
    const p = await playing(id, now);
    const answer = p.drawn[0]!.answer;
    const want = lettersOf(answer)?.length ?? 0;
    const enye = !!(await getDocument<Topic>(p.languageId))?.enyeOwn;
    if (p.format !== "wordle") throw new Error("A crossword takes letters in its cells");
    const typed = guess.trim();
    if (lettersOf(typed)?.length !== want) throw new Error(`Guess a word of ${want} letters`);
    const guesses = [...p.guesses, typed];
    const outcome = isAnswer(answer, typed, enye) ? "solved" : guesses.length >= MAX_GUESSES ? "unsolved" : "playing";
    const row = await putDocument<Puzzle>({ ...p, guesses, outcome, finishedAt: outcome === "playing" ? "" : now.toISOString() });
    return normalizePuzzle(row, now);
  });
}

/**
 * Letters into a crossword's cells, each kept as one guess in order (an
 * empty letter clears the cell). Solved once every cell holds its letter,
 * folded as the Wordle-like folds; there is no running out of guesses.
 */
export function enterCrossword(id: string, entries: { row: number; col: number; letter: string }[], now: Date = new Date()): Promise<Puzzle> {
  return serially(`play|${id}`, async () => {
    const p = await playing(id, now);
    if (p.format !== "crossword") throw new Error("Only a crossword takes letters in cells");
    const cells = new Set(crosswordCells(p).map((c) => `${c.row},${c.col}`));
    const guesses = [...p.guesses];
    for (const e of entries) {
      const letter = e.letter.trim().normalize("NFC");
      if (!cells.has(`${e.row},${e.col}`)) throw new Error("That cell is not in the grid");
      if (letter && lettersOf(letter)?.length !== 1) throw new Error("One letter per cell");
      guesses.push(entryGuess(e.row, e.col, letter));
    }
    const enye = !!(await getDocument<Topic>(p.languageId))?.enyeOwn;
    const outcome = crosswordSolved({ ...p, guesses }, enye) ? "solved" : "playing";
    const row = await putDocument<Puzzle>({ ...p, guesses, outcome, finishedAt: outcome === "solved" ? now.toISOString() : "" });
    return normalizePuzzle(row, now);
  });
}

/** Giving up ends it unsolved, the answer shown. */
export function giveUpPuzzle(id: string, now: Date = new Date()): Promise<Puzzle> {
  return serially(`play|${id}`, async () => {
    const p = await playing(id, now);
    const row = await putDocument<Puzzle>({ ...p, outcome: "unsolved", finishedAt: now.toISOString() });
    return normalizePuzzle(row, now);
  });
}

/**
 * A replay: a new Puzzle each call, drawing fresh material toward what is due
 * soonest, leaving out today's daily item where anything else remains. Never
 * a daily (no day-end expiry) and never tallied. Null when the Topic is
 * archived or has nothing to draw.
 */
export function openReplayPuzzle(topicId: string, format: PuzzleFormat, opts: { now?: Date; random?: () => number } = {}): Promise<Puzzle | null> {
  const now = opts.now ?? new Date();
  const day = todayStr(now);
  return serially(`replay|${topicId}|${format}`, async () => {
    const topic = await getDocument<Topic>(topicId);
    if (!topic || topic.type !== TOPIC || topic.archived) return null;
    if (format === "crossword") {
      const today = await topicPuzzles(topicId, now);
      const avoid = new Set(today.filter((p) => p.format === format && p.kind === "daily" && p.day === day).flatMap((p) => p.drawn.map((d) => d.itemId)));
      return putCrossword(topic, "replay", day, avoid, opts.random ?? Math.random, now);
    }
    if (format !== "wordle") return null;
    const [mine, words, recalls, sentences] = await Promise.all([topicPuzzles(topicId, now), documentsWhere<Word>(WORD, "languageId", topicId), documentsWhere<Recall>(RECALL, "languageId", topicId), documentsWhere<Sentence>(SENTENCE, "languageId", topicId)]);
    const avoid = new Set(mine.filter((p) => p.format === format && p.kind === "daily" && p.day === day).flatMap((p) => p.drawn.map((d) => d.itemId)));
    const word = pickTowardDue(wordleCandidates(topicId, words.map((w) => ({ ...w, paused: !!w.paused })), recalls), recalls, { random: opts.random ?? Math.random, avoid });
    if (!word) return null;
    const row = await putDocument<Puzzle>({ type: PUZZLE, title: `${topic.title} · Wordle-like · replay`, languageId: topicId, format, kind: "replay", day, drawn: [wordleDraw(word, sentences)], guesses: [], outcome: "playing", finishedAt: "", folder: "", tags: [] });
    return normalizePuzzle(row, now);
  });
}

// ---- The crossword ----

/** A Topic's crossword, drawn toward what is due, `avoid`'s items last: null when fewer than five cross. */
function drawCrossword(topic: Topic, items: { words: Word[]; sentences: Sentence[]; facts: Fact[] }, recalls: Recall[], random: () => number, avoid: Set<string>) {
  const enye = !!topic.enyeOwn;
  const draws = crosswordDraws(topic.id, items, recalls, enye);
  return buildCrossword(orderTowardDue(draws, recalls, { random, avoid }), orderTowardDue(draws, recalls, { random: () => 0 }), enye);
}

/** Draw a crossword from the Topic's material now and fix it by writing it. */
async function putCrossword(topic: Topic, kind: "daily" | "replay", day: DateStr, avoid: Set<string>, random: () => number, now: Date): Promise<Puzzle | null> {
  const [words, sentences, facts, recalls] = await Promise.all([documentsWhere<Word>(WORD, "languageId", topic.id), documentsWhere<Sentence>(SENTENCE, "languageId", topic.id), documentsWhere<Fact>(FACT, "languageId", topic.id), documentsWhere<Recall>(RECALL, "languageId", topic.id)]);
  const paused = <T extends { paused: boolean }>(xs: T[]) => xs.map((x) => ({ ...x, paused: !!x.paused }));
  const built = drawCrossword(topic, { words: paused(words), sentences: paused(sentences), facts: paused(facts) }, recalls, random, avoid);
  if (!built) return null;
  const row = await putDocument<Puzzle>({ type: PUZZLE, title: `${topic.title} · Crossword · ${kind === "daily" ? day : "replay"}`, languageId: topic.id, format: "crossword", kind, day, drawn: built.drawn, layout: built.layout, guesses: [], outcome: "playing", finishedAt: "", folder: "", tags: [] });
  return normalizePuzzle(row, now);
}
