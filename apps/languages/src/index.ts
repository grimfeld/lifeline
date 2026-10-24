import type { AppManifest, Document, DocumentTypeDef } from "@lifeline/core";
import { Brain, Grid3x3, History, Layers, MessageCircleQuestion, Shapes, TextCursorInput, WholeWord } from "lucide-react";
import { KnowledgeScreen } from "./screens/KnowledgeScreen";
import { DueCard } from "./cards/DueCard";
import { PuzzlesCard } from "./cards/PuzzlesCard";
import { ItemPeek } from "./components/ItemPeek";
import { WordIntakeDialog } from "./components/WordDialog";
import { SentenceIntakeDialog } from "./components/SentenceDialog";
import { FactIntakeDialog } from "./components/FactDialog";
import { knowledgeCommands } from "./commands";
import { knowledgeRecallable } from "./recallable";
import { knowledgeDaylog } from "./daylog";
import { plainSentence } from "./domain/cloze";
import { refuseDeletingUsedTopic, removeItemRecalls } from "./data/repo";
import { APP_ID, DECK, FACT, OCCURRENCE_PRACTISED, OCCURRENCE_PUZZLE, PUZZLE, TOPIC, KNOWLEDGE_HREF, RECALL, SENTENCE, WORD, type Deck, type Fact, type Puzzle, type Topic, type Recall, type Sentence, type Word } from "./domain/types";

const WORDS_HREF = `${KNOWLEDGE_HREF}?tab=words`;

/**
 * The `language` type, a Topic (CONTEXT.md "Topic", ADR 0073): the partition inside the
 * Module. Archived, never deleted while it holds anything — the `onDelete`
 * guard holds the Vault and a Base to that too. Its Tallies are Core's
 * (ADR 0059), edited in its own dialog.
 */
const topicType: DocumentTypeDef = {
  id: TOPIC,
  label: "Topics",
  icon: Shapes,
  titleRule: "derived",
  titleOf: (d) => (d as Topic).name,
  body: "none",
  fields: [
    { key: "name", label: "Name", kind: "text", required: true, column: true },
    { key: "newCap", label: "New per day", kind: "number", column: true },
    { key: "archived", label: "Archived", kind: "boolean", guarded: true, column: true },
    { key: "enyeOwn", label: "ñ is its own letter", kind: "boolean" },
    { key: "tallies", label: "Tallies", kind: "json", guarded: true },
  ],
  href: () => KNOWLEDGE_HREF,
  onDelete: refuseDeletingUsedTopic,
  order: 93,
  builtIn: true,
};

/** A Word (CONTEXT.md "Word"): deliberately not Linkable — practice material, not a subject. */
const wordType: DocumentTypeDef = {
  id: WORD,
  label: "Words",
  icon: WholeWord,
  titleRule: "derived",
  titleOf: (d) => (d as Word).term,
  body: "none",
  fields: [
    { key: "languageId", label: "Topic", kind: "link", linkType: TOPIC, guarded: true, required: true, column: true },
    { key: "term", label: "Word", kind: "text", required: true, column: true },
    { key: "meaning", label: "Meaning", kind: "text", required: true, column: true },
    { key: "notes", label: "Notes", kind: "longtext" },
    { key: "origin", label: "Where met", kind: "text" },
    { key: "originId", label: "Met in", kind: "link" },
    { key: "paused", label: "Paused", kind: "boolean", column: true },
    { key: "addedAt", label: "Added", kind: "datetime", guarded: true, hidden: true },
  ],
  indexes: ["languageId"],
  href: () => WORDS_HREF,
  peekEdit: ItemPeek,
  order: 94,
  builtIn: true,
};

/** A Sentence (CONTEXT.md "Sentence"): text with `{{blanks}}`, one Prompt per blank. */
const sentenceType: DocumentTypeDef = {
  id: SENTENCE,
  label: "Sentences",
  icon: TextCursorInput,
  titleRule: "derived",
  titleOf: (d) => plainSentence((d as Sentence).text ?? ""),
  body: "none",
  fields: [
    { key: "languageId", label: "Topic", kind: "link", linkType: TOPIC, guarded: true, required: true, column: true },
    { key: "text", label: "Sentence", kind: "text", required: true, column: true },
    { key: "translation", label: "Translation", kind: "text", column: true },
    { key: "origin", label: "Where met", kind: "text" },
    { key: "originId", label: "Met in", kind: "link" },
    { key: "paused", label: "Paused", kind: "boolean", column: true },
    { key: "addedAt", label: "Added", kind: "datetime", guarded: true, hidden: true },
  ],
  indexes: ["languageId"],
  href: () => WORDS_HREF,
  peekEdit: ItemPeek,
  order: 95,
  builtIn: true,
};

/** A Fact (CONTEXT.md "Fact"): a question and its answer in the user's own words — one Prompt, forward only. Not Linkable. */
const factType: DocumentTypeDef = {
  id: FACT,
  label: "Facts",
  icon: MessageCircleQuestion,
  titleRule: "derived",
  titleOf: (d) => (d as Fact).question,
  body: "none",
  fields: [
    { key: "languageId", label: "Topic", kind: "link", linkType: TOPIC, guarded: true, required: true, column: true },
    { key: "question", label: "Question", kind: "text", required: true, column: true },
    { key: "answer", label: "Answer", kind: "longtext", required: true, column: true },
    { key: "notes", label: "Notes", kind: "longtext" },
    { key: "origin", label: "Where met", kind: "text" },
    { key: "originId", label: "Met in", kind: "link" },
    { key: "paused", label: "Paused", kind: "boolean", column: true },
    { key: "addedAt", label: "Added", kind: "datetime", guarded: true, hidden: true },
  ],
  indexes: ["languageId"],
  href: () => WORDS_HREF,
  peekEdit: ItemPeek,
  order: 96,
  builtIn: true,
};

/** A Deck (CONTEXT.md "Deck"): membership is the Deck's, and guarded — changed only through the App. */
const deckType: DocumentTypeDef = {
  id: DECK,
  label: "Decks",
  icon: Layers,
  titleRule: "derived",
  titleOf: (d) => (d as Deck).name,
  body: "none",
  fields: [
    { key: "languageId", label: "Topic", kind: "link", linkType: TOPIC, guarded: true, required: true, column: true },
    { key: "name", label: "Name", kind: "text", required: true, column: true },
    { key: "members", label: "Holds", kind: "links", linkType: [WORD, SENTENCE, FACT], guarded: true },
  ],
  indexes: ["languageId"],
  href: () => `${KNOWLEDGE_HREF}?tab=decks`,
  order: 97,
  builtIn: true,
};

/** A Recall (CONTEXT.md "Recall", ADR 0058, internal): the only fact the App keeps about practice. */
const recallType: DocumentTypeDef = {
  id: RECALL,
  label: "Recalls",
  icon: History,
  internal: true,
  titleRule: "derived",
  titleOf: (d: Document) => {
    const r = d as Recall;
    return `${r.grade} · ${r.slot} · ${r.at?.slice(0, 10) ?? ""}`;
  },
  body: "none",
  fields: [
    { key: "languageId", label: "Topic", kind: "link", linkType: TOPIC, guarded: true, required: true, column: true },
    { key: "itemId", label: "Kept", kind: "link", linkType: [WORD, SENTENCE, FACT], guarded: true, required: true, column: true },
    { key: "slot", label: "Prompt", kind: "text", guarded: true, column: true },
    { key: "grade", label: "Grade", kind: "select", options: [{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }], guarded: true, column: true },
    { key: "at", label: "When", kind: "datetime", guarded: true, column: true },
  ],
  indexes: ["languageId", "itemId"],
  href: () => KNOWLEDGE_HREF,
  order: 98,
  builtIn: true,
};

/**
 * A Puzzle (CONTEXT.md "Puzzle", ADR 0106, internal): one word game over one
 * Topic's kept material, kept as a fact. Not Linkable, not Recallable, no body,
 * and every field the App's: what it drew is fixed when first opened.
 */
const puzzleType: DocumentTypeDef = {
  id: PUZZLE,
  label: "Puzzles",
  icon: Grid3x3,
  internal: true,
  titleRule: "derived",
  titleOf: (d: Document) => {
    const p = d as Puzzle;
    return `${p.format ?? ""} · ${p.kind ?? ""} · ${p.day ?? ""}`;
  },
  body: "none",
  fields: [
    { key: "languageId", label: "Topic", kind: "link", linkType: TOPIC, guarded: true, required: true, column: true },
    { key: "format", label: "Format", kind: "select", options: [{ value: "wordle", label: "Wordle-like" }, { value: "crossword", label: "Crossword" }, { value: "connections", label: "Connections" }], guarded: true, column: true },
    { key: "kind", label: "Kind", kind: "select", options: [{ value: "daily", label: "Daily" }, { value: "replay", label: "Replay" }], guarded: true, column: true },
    { key: "day", label: "Day", kind: "date", guarded: true, column: true },
    { key: "drawn", label: "Drew", kind: "json", guarded: true },
    { key: "guesses", label: "Guesses", kind: "json", guarded: true },
    { key: "outcome", label: "Outcome", kind: "select", options: [{ value: "playing", label: "In progress" }, { value: "solved", label: "Solved" }, { value: "unsolved", label: "Unsolved" }], guarded: true, column: true },
    { key: "finishedAt", label: "Finished", kind: "datetime", guarded: true },
    { key: "layout", label: "Grid", kind: "json", guarded: true },
  ],
  indexes: ["languageId"],
  href: () => `${KNOWLEDGE_HREF}?tab=puzzles`,
  order: 99,
  builtIn: true,
};

/**
 * Knowledge App (ADR 0073, once Languages — ADR 0058): what the user chose to
 * keep, from any Recallable type, practised by spaced repetition in Topics.
 * It owns every Recall and Practice; Word and Sentence are its own types.
 */
export const knowledgeApp: AppManifest = {
  id: APP_ID,
  module: "languages",
  title: "Knowledge",
  icon: Brain,
  color: "var(--chart-teal)",
  types: [topicType, wordType, sentenceType, factType, deckType, recallType, puzzleType],
  screens: [{ id: "languages.home", title: "Knowledge", path: "languages", icon: Brain, component: KnowledgeScreen }],
  cards: [
    {
      id: "languages.due",
      title: "Due today",
      description: "Everything due, by topic, one tap into practice",
      component: DueCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
    },
    {
      id: "languages.puzzles",
      title: "Today's Puzzles",
      description: "Each topic's daily puzzles and how they stand, one tap to play",
      component: PuzzlesCard,
      defaultSize: { w: 3, h: 3 },
      minSize: { w: 2, h: 2 },
    },
  ],
  commands: knowledgeCommands,
  daylog: knowledgeDaylog,
  tallying: [{ typeId: TOPIC, occurrence: OCCURRENCE_PRACTISED, occurrences: [{ id: OCCURRENCE_PRACTISED, label: "day practised" }, { id: OCCURRENCE_PUZZLE, label: "daily Puzzle finished" }] }],
  recallable: knowledgeRecallable,
  // Every Recallable Document's Recalls go when it is deleted — Knowledge's own types and any other App's (ADR 0073).
  forgetRecallable: removeItemRecalls,
  intakes: [
    { id: "word", title: "Word", icon: WholeWord, dialog: WordIntakeDialog },
    { id: "sentence", title: "Sentence", icon: TextCursorInput, dialog: SentenceIntakeDialog },
    { id: "fact", title: "Fact", icon: MessageCircleQuestion, dialog: FactIntakeDialog },
  ],
};

export { TOPIC, WORD, SENTENCE, FACT, DECK, RECALL, PUZZLE };
export type { Topic, Word, Sentence, Fact, Deck, Recall, Puzzle };
