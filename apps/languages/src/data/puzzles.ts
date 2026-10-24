import { useMemo } from "react";
import { addDays, documentsOf, fireTallies, documentsWhere, getDocument, putDocument, todayStr, useDocuments, type DateStr } from "@lifeline/core";
import { drawnBy, lettersOf, MAX_GUESSES, isAnswer, outcomeAt, pickTowardDue, wordleCandidates, wordleDraw, type Avoid } from "../domain/puzzle";
import { buildCrossword, crosswordCells, crosswordDraws, crosswordSolved, entryGuess, orderTowardDue, type Placement } from "../domain/crossword";
import { connectionsDraw, connectionsItems, connectionsState, GROUPS, MAX_MISTAKES as CONNECTIONS_MISTAKES, settleConnections } from "../domain/connections";
import { DECK, FACT, OCCURRENCE_PUZZLE, PUZZLE, RECALL, SENTENCE, TOPIC, WORD, type Deck, type Fact, type Puzzle, type PuzzleDraw, type PuzzleFormat, type PuzzleOutcome, type Recall, type Sentence, type Topic, type Word } from "../domain/types";

/**
 * Puzzles' data (CONTEXT.md "Puzzle", ADR 0106). Nothing here writes a
 * Recall, or calls anything that does: playing never moves the schedule.
 */

/** Every format, in the order today's Puzzles list them. */
export const PUZZLE_FORMATS = ["wordle", "crossword", "connections"] as const satisfies readonly PuzzleFormat[];

/** A recent daily's Word is drawn again only when nothing else is left. */
const AVOID_DAYS = 7;

// ---- Shapes on read: PocketBase returns absent fields as "" / undefined ----

function normalizeDraw(d: unknown): PuzzleDraw | null {
  if (!d || typeof d !== "object") return null;
  const r = d as Record<string, unknown>;
  const str = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  if (!str("answer")) return null;
  const draw: PuzzleDraw = { itemId: str("itemId"), slot: str("slot"), answer: str("answer"), clue: str("clue"), hint: str("hint") };
  if (str("deckId") || str("deck")) Object.assign(draw, { deckId: str("deckId"), deck: str("deck") });
  return draw;
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
  const read: Puzzle = { ...p, languageId: p.languageId ?? "", format: p.format || "wordle", kind: p.kind === "replay" ? "replay" : "daily", day: p.day || "", drawn, guesses, outcome, finishedAt: p.finishedAt || "", enyeOwn: p.enyeOwn === true, tags: p.tags ?? [] };
  const layout = normalizeLayout(p.layout);
  if (layout) read.layout = layout;
  return { ...read, outcome: outcomeAt(read, now) };
}

const liveFact = (f: Fact): Fact => ({ ...f, paused: !!f.paused, answer: f.answer ?? "", question: f.question || f.title || "" });
const liveSentence = (s: Sentence): Sentence => ({ ...s, paused: !!s.paused, text: s.text ?? "", translation: s.translation ?? "" });
const liveDeck = (d: Deck): Deck => ({ ...d, name: d.name || d.title || "", members: Array.isArray(d.members) ? d.members.filter((x): x is string => typeof x === "string") : [] });

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
export function todayOf(topics: Topic[], words: Word[], recalls: Recall[], puzzles: Puzzle[], now: Date, more: { facts?: Fact[]; decks?: Deck[]; sentences?: Sentence[] } = {}): TodaysPuzzle[] {
  const day = todayStr(now);
  const out: TodaysPuzzle[] = [];
  for (const topic of topics) {
    if (topic.archived) continue;
    for (const format of PUZZLE_FORMATS) {
      const puzzle = dailyOf(puzzles, topic.id, format, day) ?? null;
      if (puzzle || canBuild(topic, format, words, recalls, more)) out.push({ topic, format, puzzle });
    }
  }
  return out;
}

/** Whether a format has enough in a Topic to build one now. */
function canBuild(topic: Topic, format: PuzzleFormat, words: Word[], recalls: Recall[], more: { facts?: Fact[]; decks?: Deck[]; sentences?: Sentence[] }): boolean {
  const topicId = topic.id;
  if (format === "crossword") return drawCrossword(topic, { words, sentences: more.sentences ?? [], facts: more.facts ?? [] }, recalls, () => 0, new Map()) !== null;
  if (format === "wordle") return wordleCandidates(topicId, words, recalls).length > 0;
  if (format === "connections") return connectionsDraw(topicId, more.decks ?? [], connectionsItems(topicId, words, more.facts ?? [], recalls), recalls, { random: () => 0 }) !== null;
  return false;
}

export async function todaysPuzzles(now: Date = new Date()): Promise<TodaysPuzzle[]> {
  const [topics, words, recalls, puzzles, facts, decks, sentences] = await Promise.all([documentsOf<Topic>(TOPIC), documentsOf<Word>(WORD), documentsOf<Recall>(RECALL), documentsOf<Puzzle>(PUZZLE), documentsOf<Fact>(FACT), documentsOf<Deck>(DECK), documentsOf<Sentence>(SENTENCE)]);
  return todayOf(topics.map((t) => ({ ...t, archived: !!t.archived })), words.map((w) => ({ ...w, paused: !!w.paused })), recalls, puzzles.map((p) => normalizePuzzle(p, now)), now, { facts: facts.map(liveFact), decks: decks.map(liveDeck), sentences: sentences.map(liveSentence) });
}

/** Every Puzzle, live, read as it stands now. */
export function usePuzzles(now: Date): Puzzle[] {
  const rows = useDocuments<Puzzle>(PUZZLE);
  return useMemo(() => rows.map((p) => normalizePuzzle(p, now)), [rows, now]);
}

/** A format as the user reads it. */
export const FORMAT_LABEL: Record<PuzzleFormat, string> = { wordle: "Wordle-like", crossword: "Crossword", connections: "Connections" };

/** "Wordle-like · solved in 4", "Connections · 2 of 4 groups · 1 mistake of 4" — how a Puzzle stands, in a line. */
export function puzzleLine(p: Puzzle): string {
  const what = FORMAT_LABEL[p.format] ?? p.format;
  if (p.format === "crossword") {
    if (p.outcome !== "playing") return `${what} · ${p.outcome}`;
    const cells = crosswordCells(p);
    return `${what} · ${cells.filter((c) => c.entry).length} of ${cells.length} letters`;
  }
  if (p.format === "connections") {
    const { found, mistakes } = connectionsState(p);
    const missed = `${mistakes} mistake${mistakes === 1 ? "" : "s"}`;
    if (p.outcome === "solved") return `${what} · solved, ${missed}`;
    if (p.outcome === "unsolved") return `${what} · unsolved`;
    return `${what} · ${found.length} of ${GROUPS} groups · ${missed} of ${CONNECTIONS_MISTAKES}`;
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
    const since = addDays(day, -AVOID_DAYS);
    const avoid = drawnBy(mine.filter((p) => p.format === format && p.kind === "daily" && p.day >= since));
    const built = await drawFor(topic, format, { random: opts.random ?? Math.random, avoid });
    if (!built?.drawn.length) return null;
    const row = await putDocument<Puzzle>({ type: PUZZLE, title: `${topic.title} · ${FORMAT_LABEL[format]} · ${day}`, languageId: topicId, format, kind: "daily", day, ...built, enyeOwn: !!topic.enyeOwn, guesses: [], outcome: "playing", finishedAt: "", folder: "", tags: [] });
    return normalizePuzzle(row, now);
  });
}

/** What a format draws from a Topic now (and a crossword's grid), or null when there is not enough to build it. */
async function drawFor(topic: Topic, format: PuzzleFormat, opts: { random: () => number; avoid: Avoid }): Promise<{ drawn: PuzzleDraw[]; layout?: Placement[] } | null> {
  const built = await drawn(topic, format, opts);
  return Array.isArray(built) ? { drawn: built } : built;
}

async function drawn(topic: Topic, format: PuzzleFormat, opts: { random: () => number; avoid: Avoid }): Promise<PuzzleDraw[] | { drawn: PuzzleDraw[]; layout: Placement[] } | null> {
  const topicId = topic.id;
  const [words, recalls] = await Promise.all([documentsWhere<Word>(WORD, "languageId", topicId), documentsWhere<Recall>(RECALL, "languageId", topicId)]);
  const live = words.map((w) => ({ ...w, paused: !!w.paused }));
  if (format === "wordle") {
    const sentences = await documentsWhere<Sentence>(SENTENCE, "languageId", topicId);
    const word = pickTowardDue(wordleCandidates(topicId, live, recalls), recalls, opts);
    return word ? [wordleDraw(word, sentences, !!topic.enyeOwn)] : null;
  }
  if (format === "crossword") {
    const [sentences, facts] = await Promise.all([documentsWhere<Sentence>(SENTENCE, "languageId", topicId), documentsWhere<Fact>(FACT, "languageId", topicId)]);
    return drawCrossword(topic, { words: live, sentences: sentences.map(liveSentence), facts: facts.map(liveFact) }, recalls, opts.random, opts.avoid);
  }
  if (format === "connections") {
    const [facts, decks] = await Promise.all([documentsWhere<Fact>(FACT, "languageId", topicId), documentsWhere<Deck>(DECK, "languageId", topicId)]);
    return connectionsDraw(topicId, decks.map(liveDeck), connectionsItems(topicId, live, facts.map(liveFact), recalls), recalls, opts);
  }
  return null;
}

/** Read for a write: refuses a Puzzle that is finished, or a daily whose day is over. */
async function playing(id: string, now: Date): Promise<Puzzle> {
  const p = await getPuzzle(id, now);
  if (!p || !playable(p)) throw new Error("That puzzle no longer exists");
  if (p.kind === "daily" && p.day < todayStr(now)) throw new Error("This daily puzzle ended at midnight");
  if (p.outcome !== "playing") throw new Error("This puzzle is already finished");
  return p;
}

/** A Puzzle just written, with the error of a Tally that failed to fire for it. */
export type Played = Puzzle & { tallyError?: string };

/**
 * A daily Puzzle's finishing is its Topic's second occurrence (ADR 0106),
 * once, keyed by the Puzzle. A failing Tally never loses the outcome. A
 * replay never tallies, and an expired daily is refused before it gets here.
 */
async function finished(before: Puzzle, after: Puzzle): Promise<Played> {
  if (before.outcome !== "playing" || after.outcome === "playing" || after.kind !== "daily") return after;
  const topic = await getDocument<Topic>(after.languageId);
  if (!topic || topic.type !== TOPIC || topic.archived) return after;
  try {
    await fireTallies(topic, { key: after.id, at: after.finishedAt, occurrence: OCCURRENCE_PUZZLE, note: `Finished the ${topic.title} puzzle` });
    return after;
  } catch (err) {
    return { ...after, tallyError: (err as Error).message };
  }
}

/** Letters into a crossword's cells; an empty letter clears one. */
export type CellEntry = { row: number; col: number; letter: string };

/**
 * One guess: at a Wordle-like, any word of the answer's length, no dictionary;
 * at a Connections, a group of four item ids; at a crossword, cell entries.
 * Appended, then the outcome settled — solved, or unsolved on the sixth miss
 * (the fourth mistake); a crossword is solved once every cell is right.
 */
export function guessPuzzle(id: string, guess: string | readonly string[] | readonly CellEntry[], now: Date = new Date()): Promise<Played> {
  return serially(`play|${id}`, async () => {
    const p = await playing(id, now);
    const enye = !!p.enyeOwn;
    const { guesses, outcome } = p.format === "connections" ? settleConnections(p, asGroup(guess)) : p.format === "crossword" ? settleCrossword(p, asCells(guess), enye) : settleWordle(p, asWord(guess), enye);
    const row = await putDocument<Puzzle>({ ...p, guesses, outcome, finishedAt: outcome === "playing" ? "" : now.toISOString() });
    return finished(p, normalizePuzzle(row, now));
  });
}

function asGroup(guess: string | readonly string[] | readonly CellEntry[]): readonly string[] {
  if (typeof guess === "string" || !guess.every((g) => typeof g === "string")) throw new Error("Pick a group of four");
  return guess as readonly string[];
}

function asCells(guess: string | readonly string[] | readonly CellEntry[]): readonly CellEntry[] {
  if (typeof guess === "string" || !guess.every((g) => typeof g === "object" && g !== null)) throw new Error("A crossword takes letters in its cells");
  return guess as readonly CellEntry[];
}

/**
 * Crossword entries checked and appended, each kept as one guess in order.
 * Solved once every cell holds its letter, folded as the Wordle-like folds;
 * there is no running out of guesses.
 */
function settleCrossword(p: Puzzle, entries: readonly CellEntry[], enye: boolean): { guesses: string[]; outcome: PuzzleOutcome } {
  const cells = new Set(crosswordCells(p).map((c) => `${c.row},${c.col}`));
  const guesses = [...p.guesses];
  for (const e of entries) {
    const letter = e.letter.trim().normalize("NFC");
    if (!cells.has(`${e.row},${e.col}`)) throw new Error("That cell is not in the grid");
    if (letter && lettersOf(letter)?.length !== 1) throw new Error("One letter per cell");
    guesses.push(entryGuess(e.row, e.col, letter));
  }
  return { guesses, outcome: crosswordSolved({ ...p, guesses }, enye) ? "solved" : "playing" };
}

function asWord(guess: string | readonly string[] | readonly CellEntry[]): string {
  if (typeof guess !== "string") throw new Error("Guess a word");
  return guess;
}

/** A Wordle-like guess checked and appended: solved, or unsolved on the sixth miss. */
function settleWordle(p: Puzzle, guess: string, enye: boolean): { guesses: string[]; outcome: PuzzleOutcome } {
  const answer = p.drawn[0]!.answer;
  const want = lettersOf(answer)?.length ?? 0;
  const typed = guess.trim();
  if (lettersOf(typed)?.length !== want) throw new Error(`Guess a word of ${want} letters`);
  const guesses = [...p.guesses, typed];
  return { guesses, outcome: isAnswer(answer, typed, enye) ? "solved" : guesses.length >= MAX_GUESSES ? "unsolved" : "playing" };
}

/** Giving up ends it unsolved, the answer shown. */
export function giveUpPuzzle(id: string, now: Date = new Date()): Promise<Played> {
  return serially(`play|${id}`, async () => {
    const p = await playing(id, now);
    const row = await putDocument<Puzzle>({ ...p, outcome: "unsolved", finishedAt: now.toISOString() });
    return finished(p, normalizePuzzle(row, now));
  });
}

/**
 * A replay: a new Puzzle each call, drawing fresh material toward what is due
 * soonest, leaving out what today's daily and replays drew where anything else
 * remains, then the least recently drawn. Never
 * a daily (no day-end expiry) and never tallied. Null when the Topic is
 * archived or has nothing to draw.
 */
export function openReplayPuzzle(topicId: string, format: PuzzleFormat, opts: { now?: Date; random?: () => number } = {}): Promise<Puzzle | null> {
  const now = opts.now ?? new Date();
  const day = todayStr(now);
  return serially(`replay|${topicId}|${format}`, async () => {
    const topic = await getDocument<Topic>(topicId);
    if (!topic || topic.type !== TOPIC || topic.archived) return null;
    const mine = await topicPuzzles(topicId, now);
    const avoid = drawnBy(mine.filter((p) => p.format === format && p.day === day));
    const built = await drawFor(topic, format, { random: opts.random ?? Math.random, avoid });
    if (!built?.drawn.length) return null;
    const row = await putDocument<Puzzle>({ type: PUZZLE, title: `${topic.title} · ${FORMAT_LABEL[format]} · replay`, languageId: topicId, format, kind: "replay", day, ...built, enyeOwn: !!topic.enyeOwn, guesses: [], outcome: "playing", finishedAt: "", folder: "", tags: [] });
    return normalizePuzzle(row, now);
  });
}

// ---- The crossword ----

/** A Topic's crossword, drawn toward what is due, `avoid`'s items last: null when fewer than five cross. */
function drawCrossword(topic: Topic, items: { words: Word[]; sentences: Sentence[]; facts: Fact[] }, recalls: Recall[], random: () => number, avoid: Avoid) {
  const enye = !!topic.enyeOwn;
  const draws = crosswordDraws(topic.id, items, recalls, enye);
  return buildCrossword(orderTowardDue(draws, recalls, { random, avoid }), orderTowardDue(draws, recalls, { random: () => 0 }), enye);
}
