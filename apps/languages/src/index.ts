import type { AppManifest, Document, DocumentTypeDef } from "@lifeline/core";
import { History, Languages, Layers, TextCursorInput, WholeWord } from "lucide-react";
import { LanguagesScreen } from "./screens/LanguagesScreen";
import { DueCard } from "./cards/DueCard";
import { ItemPeek } from "./components/ItemPeek";
import { WordIntakeDialog } from "./components/WordDialog";
import { SentenceIntakeDialog } from "./components/SentenceDialog";
import { languagesCommands } from "./commands";
import { languagesDaylog } from "./daylog";
import { plainSentence } from "./domain/cloze";
import { refuseDeletingUsedLanguage, removeItemRecalls } from "./data/repo";
import { APP_ID, DECK, LANGUAGE, LANGUAGES_HREF, RECALL, SENTENCE, WORD, type Deck, type Language, type Recall, type Sentence, type Word } from "./domain/types";

const WORDS_HREF = `${LANGUAGES_HREF}?tab=words`;

/**
 * The `language` type (CONTEXT.md "Language"): the partition inside the
 * Module. Archived, never deleted while it holds anything — the `onDelete`
 * guard holds the Vault and a Base to that too. Its Tallies are Core's
 * (ADR 0059), edited in its own dialog.
 */
const languageType: DocumentTypeDef = {
  id: LANGUAGE,
  label: "Languages",
  icon: Languages,
  titleRule: "derived",
  titleOf: (d) => (d as Language).name,
  body: "none",
  fields: [
    { key: "name", label: "Name", kind: "text", required: true, column: true },
    { key: "newCap", label: "New per day", kind: "number", column: true },
    { key: "archived", label: "Archived", kind: "boolean", guarded: true, column: true },
    { key: "tallies", label: "Tallies", kind: "json", guarded: true },
  ],
  href: () => LANGUAGES_HREF,
  onDelete: refuseDeletingUsedLanguage,
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
    { key: "languageId", label: "Language", kind: "link", linkType: LANGUAGE, guarded: true, required: true, column: true },
    { key: "term", label: "Word", kind: "text", required: true, column: true },
    { key: "meaning", label: "Meaning", kind: "text", required: true, column: true },
    { key: "notes", label: "Notes", kind: "longtext" },
    { key: "origin", label: "Where met", kind: "text" },
    { key: "paused", label: "Paused", kind: "boolean", column: true },
    { key: "addedAt", label: "Added", kind: "datetime", guarded: true, hidden: true },
  ],
  indexes: ["languageId"],
  href: () => WORDS_HREF,
  peek: ItemPeek,
  onDelete: removeItemRecalls,
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
    { key: "languageId", label: "Language", kind: "link", linkType: LANGUAGE, guarded: true, required: true, column: true },
    { key: "text", label: "Sentence", kind: "text", required: true, column: true },
    { key: "translation", label: "Translation", kind: "text", column: true },
    { key: "origin", label: "Where met", kind: "text" },
    { key: "paused", label: "Paused", kind: "boolean", column: true },
    { key: "addedAt", label: "Added", kind: "datetime", guarded: true, hidden: true },
  ],
  indexes: ["languageId"],
  href: () => WORDS_HREF,
  peek: ItemPeek,
  onDelete: removeItemRecalls,
  order: 95,
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
    { key: "languageId", label: "Language", kind: "link", linkType: LANGUAGE, guarded: true, required: true, column: true },
    { key: "name", label: "Name", kind: "text", required: true, column: true },
    { key: "members", label: "Words and sentences", kind: "links", linkType: [WORD, SENTENCE], guarded: true },
  ],
  indexes: ["languageId"],
  href: () => `${LANGUAGES_HREF}?tab=decks`,
  order: 96,
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
    { key: "languageId", label: "Language", kind: "link", linkType: LANGUAGE, guarded: true, required: true, column: true },
    { key: "itemId", label: "Word or sentence", kind: "link", linkType: [WORD, SENTENCE], guarded: true, required: true, column: true },
    { key: "slot", label: "Prompt", kind: "text", guarded: true, column: true },
    { key: "grade", label: "Grade", kind: "select", options: [{ value: "pass", label: "Pass" }, { value: "fail", label: "Fail" }], guarded: true, column: true },
    { key: "at", label: "When", kind: "datetime", guarded: true, column: true },
  ],
  indexes: ["languageId", "itemId"],
  href: () => LANGUAGES_HREF,
  order: 97,
  builtIn: true,
};

/** Languages App (ADR 0058): Words and Sentences the user met, kept by spaced repetition. */
export const languagesApp: AppManifest = {
  id: APP_ID,
  module: "languages",
  title: "Languages",
  icon: Languages,
  color: "var(--chart-teal)",
  types: [languageType, wordType, sentenceType, deckType, recallType],
  screens: [{ id: "languages.home", title: "Languages", path: "languages", icon: Languages, component: LanguagesScreen }],
  cards: [
    {
      id: "languages.due",
      title: "Due today",
      description: "What the active language has due, one tap into practice",
      component: DueCard,
      defaultSize: { w: 3, h: 4 },
      minSize: { w: 2, h: 3 },
    },
  ],
  commands: languagesCommands,
  daylog: languagesDaylog,
  tallying: [{ typeId: LANGUAGE, occurrence: "day practised" }],
  intakes: [
    { id: "word", title: "Word", icon: WholeWord, dialog: WordIntakeDialog },
    { id: "sentence", title: "Sentence", icon: TextCursorInput, dialog: SentenceIntakeDialog },
  ],
};

export { LANGUAGE, WORD, SENTENCE, DECK, RECALL };
export type { Language, Word, Sentence, Deck, Recall };
