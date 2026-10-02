import type { CommandDef } from "@lifeline/core";
import { Languages, Play, Plus, TextCursorInput } from "lucide-react";
import { LANGUAGE, LANGUAGES_HREF } from "./domain/types";
import { addSentence, addWord, allLanguages, allSentences, allWords } from "./data/repo";

/** A headless add goes into a Language the user still learns: named, never the device's active one. */
async function openLanguage(id: string) {
  const language = (await allLanguages()).find((l) => l.id === id)!;
  if (language.archived) throw new Error(`${language.title} is archived`);
  return language;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
import { WordDialog } from "./components/WordDialog";
import { SentenceDialog } from "./components/SentenceDialog";

function AddWordDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <WordDialog {...props} />;
}

function AddSentenceDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <SentenceDialog {...props} />;
}

export const languagesCommands: CommandDef[] = [
  {
    id: "languages.word",
    title: "Add word…",
    keywords: ["languages", "word", "vocabulary", "vocab", "term", "meaning"],
    icon: Plus,
    dialog: AddWordDialog,
    capture: true,
    args: [
      { key: "language", label: "Language", kind: "link", linkType: LANGUAGE, required: true, hint: "The Language it belongs to, e.g. Spanish." },
      { key: "term", label: "Term", kind: "text", required: true, hint: "In the target language; may be several words." },
      { key: "meaning", label: "Meaning", kind: "text", required: true, hint: "In the user's own words." },
      { key: "notes", label: "Notes", kind: "longtext" },
      { key: "origin", label: "Where it was met", kind: "text" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const language = await openLanguage(a.language as string);
      const term = a.term as string;
      const twin = (await allWords()).find((w) => w.languageId === language.id && same(w.term, term));
      if (twin) throw new Error(`“${twin.term}” is already a ${language.title} word; tell the user — nothing was changed`);
      const id = await addWord({ languageId: language.id, term, meaning: a.meaning as string, notes: a.notes as string | undefined, origin: a.origin as string | undefined, tags: a.tags as string[] | undefined });
      return { id, message: `${term.trim()} added to ${language.title}` };
    },
  },
  {
    id: "languages.sentence",
    title: "Add sentence…",
    keywords: ["languages", "sentence", "cloze", "blank", "phrase"],
    icon: TextCursorInput,
    dialog: AddSentenceDialog,
    capture: true,
    args: [
      { key: "language", label: "Language", kind: "link", linkType: LANGUAGE, required: true, hint: "The Language it belongs to, e.g. Spanish." },
      { key: "text", label: "Sentence", kind: "longtext", required: true, hint: "Each blank in double braces: Tengo {{ganas}} de ir." },
      { key: "translation", label: "Translation", kind: "text", hint: "Shown with every Prompt, so each blank has one answer." },
      { key: "origin", label: "Where it was met", kind: "text" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const language = await openLanguage(a.language as string);
      const text = a.text as string;
      const twin = (await allSentences()).find((s) => s.languageId === language.id && same(s.text, text));
      if (twin) throw new Error(`That sentence is already in ${language.title}; tell the user — nothing was changed`);
      const id = await addSentence({ languageId: language.id, text, translation: a.translation as string | undefined, origin: a.origin as string | undefined, tags: a.tags as string[] | undefined });
      const blanks = (text.match(/\{\{\s*\S.*?\}\}/g) ?? []).length;
      return { id, message: `Sentence added to ${language.title} · ${blanks} prompt${blanks === 1 ? "" : "s"}` };
    },
  },
  { id: "languages.practise", title: "Practise", keywords: ["languages", "practice", "practise", "review", "recall", "flashcards"], icon: Play, run: ({ navigate }) => navigate(LANGUAGES_HREF) },
  { id: "languages.open", title: "Go to Languages", keywords: ["languages", "words", "decks"], icon: Languages, run: ({ navigate }) => navigate(LANGUAGES_HREF) },
];
