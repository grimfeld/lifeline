import { useMemo } from "react";
import { addDays, documentsOf, documentsWhere, getDocument, putDocument, todayStr, useDocuments, type DateStr } from "@lifeline/core";
import { lettersOf, MAX_GUESSES, isAnswer, outcomeAt, pickTowardDue, wordleCandidates, wordleDraw } from "../domain/puzzle";
import { PUZZLE, RECALL, SENTENCE, TOPIC, WORD, type Puzzle, type PuzzleDraw, type PuzzleFormat, type Recall, type Sentence, type Topic, type Word } from "../domain/types";

/**
 * Puzzles' data (CONTEXT.md "Puzzle", ADR 0106). Nothing here writes a
 * Recall, or calls anything that does: playing never moves the schedule.
 */

/** The formats built so far; a crossword and Connections join later. */
export const PUZZLE_FORMATS = ["wordle"] as const satisfies readonly PuzzleFormat[];

/** A recent daily's Word is drawn again only when nothing else is left. */
const AVOID_DAYS = 7;

// ---- Shapes on read: PocketBase returns absent fields as "" / undefined ----

function normalizeDraw(d: unknown): PuzzleDraw | null {
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  return str("answer") ? { itemId: str("itemId"), slot: str("slot"), answer: str("answer"), clue: str("clue"), hint: str("hint") } : null;
}

/** Read as it stands at `now`: a daily left playing past midnight reads unsolved. */
export function normalizePuzzle(p: Puzzle, now: Date = new Date()): Puzzle {
  const drawn = Array.isArray(p.drawn) ? p.drawn.map(normalizeDraw).filter((d): d is PuzzleDraw => d !== null) : [];
  const guesses = Array.isArray(p.guesses) ? p.guesses.filter((g): g is string => typeof g === "string") : [];
  const outcome = p.outcome === "solved" || p.outcome === "unsolved" ? p.outcome : "playing";
  const read: Puzzle = { ...p, languageId: p.languageId ?? "", format: p.format || "wordle", kind: p.kind === "replay" ? "replay" : "daily", day: p.day || "", drawn, guesses, outcome, finishedAt: p.finishedAt || "", tags: p.tags ?? [] };
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
export function todayOf(topics: Topic[], words: Word[], recalls: Recall[], puzzles: Puzzle[], now: Date): TodaysPuzzle[] {
  const day = todayStr(now);
  const out: TodaysPuzzle[] = [];
  for (const topic of topics) {
    if (topic.archived) continue;
    for (const format of PUZZLE_FORMATS) {
      const puzzle = dailyOf(puzzles, topic.id, format, day) ?? null;
      if (puzzle || wordleCandidates(topic.id, words, recalls).length) out.push({ topic, format, puzzle });
    }
  }
  return out;
}

export async function todaysPuzzles(now: Date = new Date()): Promise<TodaysPuzzle[]> {
  const [topics, words, recalls, puzzles] = await Promise.all([documentsOf<Topic>(TOPIC), documentsOf<Word>(WORD), documentsOf<Recall>(RECALL), documentsOf<Puzzle>(PUZZLE)]);
  return todayOf(topics.map((t) => ({ ...t, archived: !!t.archived })), words.map((w) => ({ ...w, paused: !!w.paused })), recalls, puzzles.map((p) => normalizePuzzle(p, now)), now);
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
    const typed = guess.trim();
    if (lettersOf(typed)?.length !== want) throw new Error(`Guess a word of ${want} letters`);
    const guesses = [...p.guesses, typed];
    const outcome = isAnswer(answer, typed, enye) ? "solved" : guesses.length >= MAX_GUESSES ? "unsolved" : "playing";
    const row = await putDocument<Puzzle>({ ...p, guesses, outcome, finishedAt: outcome === "playing" ? "" : now.toISOString() });
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
