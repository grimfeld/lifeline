import { VAULT_FRAME, type AppManifest, type DocumentTypeDef } from "@lifeline/core";
import { BookMarked, BookOpen, Lightbulb, Quote, ScrollText, Users } from "lucide-react";
import { BibleDeskScreen } from "./screens/BibleDeskScreen";
import { BibleScreen } from "./screens/BibleScreen";
import { RecentStudyCard } from "./cards/RecentStudyCard";
import { ReferencesPanel } from "./panels/ReferencesPanel";
import { bibleCommands } from "./commands";
import { expanders } from "./domain/refs";
import { useBibleBackground } from "./data/repo";
import { APP_ID, BIBLE_BOOK, BIBLE_CHAPTER, CHARACTER, CONCEPT, VERSE, type BibleBook, type BibleChapter, type Verse } from "./domain/types";

/** `bible_book` (ADR 0032): a book of the Bible, created on first mention; its abbreviations are its aliases. */
// Scripture types stay out of generic Unlinked mentions (`mentions: false`): the References panel offers bare "Rom 8:28" itself.
const bookType: DocumentTypeDef = {
  id: BIBLE_BOOK,
  label: "Bible books",
  icon: BookMarked,
  titleRule: "name",
  body: "optional",
  vault: true,
  fields: [
    { key: "order", label: "Order", kind: "number", guarded: true, hidden: true },
    { key: "testament", label: "Testament", kind: "select", options: [{ value: "OT", label: "Old Testament" }, { value: "NT", label: "New Testament" }], guarded: true, column: true },
    { key: "aliases", label: "Also written", kind: "list", guarded: true },
  ],
  linkable: { aliasesField: "aliases", subtitle: (d) => ((d as BibleBook).testament === "OT" ? "Old Testament" : "New Testament"), expand: expanders.book, mentions: false },
  order: 60,
  builtIn: true,
};

/** `bible_chapter`: a chapter, belonging to its Book. */
const chapterType: DocumentTypeDef = {
  id: BIBLE_CHAPTER,
  label: "Chapters",
  icon: ScrollText,
  titleRule: "name",
  body: "optional",
  vault: true,
  fields: [
    { key: "bookId", label: "Book", kind: "link", linkType: BIBLE_BOOK, guarded: true, required: true, column: true },
    { key: "book", label: "Book name", kind: "text", guarded: true, hidden: true },
    { key: "chapter", label: "Chapter", kind: "number", guarded: true, column: true },
  ],
  indexes: ["bookId"],
  linkable: { subtitle: (d) => `${(d as BibleChapter).book}, chapter ${(d as BibleChapter).chapter}`, expand: expanders.chapter, mentions: false },
  order: 61,
  builtIn: true,
};

/** `verse`: one verse — a hub, no text. A range wikilink resolves to each through `expand`. */
const verseType: DocumentTypeDef = {
  id: VERSE,
  label: "Verses",
  icon: Quote,
  titleRule: "name",
  body: "optional",
  vault: true,
  fields: [
    { key: "chapterId", label: "Chapter", kind: "link", linkType: BIBLE_CHAPTER, guarded: true, required: true, column: true },
    { key: "bookId", label: "Book", kind: "link", linkType: BIBLE_BOOK, guarded: true, hidden: true },
    { key: "book", label: "Book name", kind: "text", guarded: true, hidden: true },
    { key: "chapter", label: "Chapter no.", kind: "number", guarded: true, hidden: true },
    { key: "verse", label: "Verse", kind: "number", guarded: true, column: true },
  ],
  indexes: ["chapterId"],
  linkable: { subtitle: (d) => `${(d as Verse).book} ${(d as Verse).chapter}`, expand: expanders.verse, mentions: false },
  order: 62,
  builtIn: true,
};

/** `character`: a person of the Bible. */
const characterType: DocumentTypeDef = {
  id: CHARACTER,
  label: "Characters",
  icon: Users,
  titleRule: "name",
  body: "optional",
  vault: true,
  fields: [{ key: "aliases", label: "Also written", kind: "list", column: true }],
  linkable: { aliasesField: "aliases", subtitle: () => "Bible character" },
  folder: "Bible/Characters",
  order: 63,
  builtIn: true,
};

/** `concept`: an idea the study keeps returning to. */
const conceptType: DocumentTypeDef = {
  id: CONCEPT,
  label: "Concepts",
  icon: Lightbulb,
  titleRule: "name",
  body: "optional",
  vault: true,
  fields: [{ key: "aliases", label: "Also written", kind: "list", column: true }],
  linkable: { aliasesField: "aliases", subtitle: () => "Concept" },
  folder: "Bible/Concepts",
  order: 64,
  builtIn: true,
};

/** Bible App (ADR 0032): a lens over the study — owns the references, scopes the material. */
export const bibleApp: AppManifest = {
  id: APP_ID,
  module: "journal",
  title: "Bible study",
  icon: BookOpen,
  color: "var(--chart-aqua)",
  types: [bookType, chapterType, verseType, characterType, conceptType],
  screens: [
    { id: "bible.desk", title: "Bible study", path: "bible", icon: BookOpen, component: BibleDeskScreen, frame: VAULT_FRAME },
    { id: "bible.phone", title: "Bible quick", path: "bible", icon: BookOpen, component: BibleScreen },
  ],
  cards: [
    {
      id: "bible.recent",
      title: "Recent study",
      description: "The last few notes, clippings and writings of the Bible study",
      component: RecentStudyCard,
      tagFilterable: true,
      defaultSize: { w: 3, h: 5 },
      minSize: { w: 2, h: 3 },
      settings: { count: { kind: "number", label: "How many", default: 8, min: 1, max: 30 } },
    },
  ],
  commands: bibleCommands,
  documentPanels: [{ id: "references", component: ReferencesPanel }],
  useBackground: useBibleBackground,
};

export { BIBLE_BOOK, BIBLE_CHAPTER, VERSE, CHARACTER, CONCEPT };
export type { BibleBook, BibleChapter, Verse, Character, Concept } from "./domain/types";
