import type { DateStr, Document } from "@lifeline/core";
import type { Placement } from "./crossword";

/** Stored ids keep the retired Languages name (ADR 0073): App, Module, URL, the `language` type and every `languageId`. */
export const APP_ID = "languages";
export const KNOWLEDGE_HREF = "/app/languages";

/** Document type ids (ADR 0058) — stored, so a Topic is still the `language` type (ADR 0073). */
export const TOPIC = "language";
export const WORD = "language_word";
export const SENTENCE = "language_sentence";
export const DECK = "language_deck";
export const RECALL = "language_recall";
/** New with Knowledge (ADR 0073), so it carries Knowledge's name. */
export const FACT = "knowledge_fact";
/** New with Knowledge too (ADR 0106), so `knowledge_` like the Fact. */
export const PUZZLE = "knowledge_puzzle";

/** The daily new cap a Topic starts with (CONTEXT.md "Prompt"). */
export const DEFAULT_NEW_CAP = 10;

/**
 * A Topic (CONTEXT.md "Topic"): the partition inside the Module. Every
 * Word, Sentence and Deck belongs to exactly one. Archived instead of deleted
 * while it holds anything.
 */
export interface Topic extends Document {
  type: typeof TOPIC;
  /** "Spanish" — also the title. */
  name: string;
  /** How many new Prompts enter practice per day at most. */
  newCap: number;
  archived: boolean;
  /** "ñ is its own letter" (Puzzles, ADR 0106): off (the default) folds ñ to n when a guess is matched. */
  enyeOwn?: boolean;
}

/** A Word (CONTEXT.md "Word"): a term met in the wild, its meaning in the user's own words. Yields forward and reverse. */
export interface Word extends Document {
  type: typeof WORD;
  languageId: string;
  /** "tener ganas de" — also the title. */
  term: string;
  meaning: string;
  notes: string;
  /** Where it was met, in words or a URL: "Pedro at dinner". */
  origin: string;
  /** Where it was met, as a link to the Document it came from (a Note, a Quote) — followed, never copied. Empty for none. */
  originId: string;
  paused: boolean;
  /** ISO instant it was added — what "oldest added first" orders new Prompts by. */
  addedAt: string;
}

/** A Sentence (CONTEXT.md "Sentence"): text with `{{blanks}}`, one Prompt per blank. */
export interface Sentence extends Document {
  type: typeof SENTENCE;
  languageId: string;
  /** "Tengo {{ganas}} de {{comer}}". */
  text: string;
  /** In the user's own words, shown with each Prompt. */
  translation: string;
  origin: string;
  originId: string;
  paused: boolean;
  addedAt: string;
}

/** A Deck (CONTEXT.md "Deck"): a chosen set of Words and Sentences inside one Topic. Membership is the Deck's. */
export interface Deck extends Document {
  type: typeof DECK;
  languageId: string;
  name: string;
  /** Ids of what it holds — Words, Sentences, Facts. */
  members: string[];
}

export type Grade = "pass" | "fail";

/**
 * A Recall (CONTEXT.md "Recall", ADR 0058, internal): one self-graded attempt
 * at one Prompt — the only fact the App keeps about practice. `languageId` is
 * copied from the item so "the day's first Recall in this Topic" is one
 * read.
 */
export interface Recall extends Document {
  type: typeof RECALL;
  languageId: string;
  /** The Recallable Document the Prompt came from. */
  itemId: string;
  /** "forward", "reverse", or "blank:<text>". */
  slot: string;
  grade: Grade;
  /** ISO instant. */
  at: string;
}

/**
 * A Fact (CONTEXT.md "Fact"): a question and its answer, both in the user's
 * own words. One Prompt, forward only — its answer is no cue for its question.
 */
export interface Fact extends Document {
  type: typeof FACT;
  languageId: string;
  /** "When was the Peace of Westphalia?" — also the title. */
  question: string;
  answer: string;
  notes: string;
  origin: string;
  originId: string;
  paused: boolean;
  addedAt: string;
}

/** A Word, a Sentence or a Fact — Knowledge's own Recallable types. */
export type Item = Word | Sentence | Fact;

/**
 * One Recallable Document as Practice reads it, through the Contract
 * (ADR 0073) — whatever App owns it. Practice knows nothing else about it.
 */
export interface Material {
  id: string;
  type: string;
  title: string;
  topicId: string;
  addedAt: string;
  /** False while paused or no longer kept: out of every Practice, Recalls kept. */
  live: boolean;
  slots: string[];
  /** The Document it was taken from — followed to its Source, never copied. Empty for none. */
  originId: string;
}

/** A Puzzle's format (CONTEXT.md "Puzzle"): a field, not a term. Only the Wordle-like is built so far. */
export type PuzzleFormat = "wordle" | "crossword" | "connections";

/** One per format per Topic per day, or as many replays as wanted. */
export type PuzzleKind = "daily" | "replay";

/** Given up and expired at midnight both count as unsolved. */
export type PuzzleOutcome = "playing" | "solved" | "unsolved";

/**
 * One piece of material a Puzzle drew, as it was when drawn: the item and the
 * Prompt it plays, plus a snapshot of its answer and clue — so the Puzzle
 * stays readable after the item is edited or deleted.
 */
export interface PuzzleDraw {
  itemId: string;
  /** The Prompt it plays: a Word's "reverse", a Fact's "forward", a Sentence's "blank:<text>". */
  slot: string;
  /** In the stored spelling, accents and all: what the grid and the reveal show. */
  answer: string;
  /** A Word's meaning, a Fact's question, a Sentence with its blank. */
  clue: string;
  /** A second clue, empty for none: a Sentence's translation. */
  hint: string;
}

/**
 * A Puzzle (CONTEXT.md "Puzzle", ADR 0106, internal): one word game over one
 * Topic's kept material, kept as a fact — what it drew is fixed when first
 * opened. Never writes a Recall. A crossword keeps its grid layout beside
 * these; a Connections will add its groups.
 */
export interface Puzzle extends Document {
  type: typeof PUZZLE;
  languageId: string;
  format: PuzzleFormat;
  kind: PuzzleKind;
  /** The local day it belongs to. */
  day: DateStr;
  drawn: PuzzleDraw[];
  /** Each guess in order, as typed: a Wordle-like's word. Later formats write theirs as a string too. */
  guesses: string[];
  /** As stored: a daily still "playing" from an earlier day reads as unsolved. */
  outcome: PuzzleOutcome;
  /** ISO instant it was solved or given up; empty while playing (and for one left to expire). */
  finishedAt: string;
  /** A crossword's grid: where each drawn answer sits, side by side with `drawn`. Absent for other formats. */
  layout?: Placement[];
}
