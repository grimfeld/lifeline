import type { CommandDef } from "@lifeline/core";
import { Languages, Play, Plus, TextCursorInput } from "lucide-react";
import { LANGUAGES_HREF } from "./domain/types";
import { WordDialog } from "./components/WordDialog";
import { SentenceDialog } from "./components/SentenceDialog";

function AddWordDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <WordDialog {...props} />;
}

function AddSentenceDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <SentenceDialog {...props} />;
}

export const languagesCommands: CommandDef[] = [
  { id: "languages.word", title: "Add word…", keywords: ["languages", "word", "vocabulary", "vocab", "term", "meaning"], icon: Plus, dialog: AddWordDialog, capture: true },
  { id: "languages.sentence", title: "Add sentence…", keywords: ["languages", "sentence", "cloze", "blank", "phrase"], icon: TextCursorInput, dialog: AddSentenceDialog, capture: true },
  { id: "languages.practise", title: "Practise", keywords: ["languages", "practice", "practise", "review", "recall", "flashcards"], icon: Play, run: ({ navigate }) => navigate(LANGUAGES_HREF) },
  { id: "languages.open", title: "Go to Languages", keywords: ["languages", "words", "decks"], icon: Languages, run: ({ navigate }) => navigate(LANGUAGES_HREF) },
];
