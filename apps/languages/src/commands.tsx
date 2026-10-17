import type { CommandDef } from "@lifeline/core";
import { Brain, MessageCircleQuestion, Play, Plus, TextCursorInput } from "lucide-react";
import { TOPIC, KNOWLEDGE_HREF } from "./domain/types";
import { addFact, addSentence, addWord, allFacts, allTopics, allSentences, allWords } from "./data/repo";

/** A headless add goes into a Topic still in use (not archived): named, never the device’s active one. */
async function openTopic(id: string) {
  const topic = (await allTopics()).find((l) => l.id === id)!;
  if (topic.archived) throw new Error(`${topic.title} is archived`);
  return topic;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
import { WordDialog } from "./components/WordDialog";
import { SentenceDialog } from "./components/SentenceDialog";
import { FactDialog } from "./components/FactDialog";

function AddWordDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <WordDialog {...props} />;
}

function AddSentenceDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <SentenceDialog {...props} />;
}

function AddFactDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <FactDialog {...props} />;
}

export const knowledgeCommands: CommandDef[] = [
  {
    id: "knowledge.word",
    title: "Add word…",
    keywords: ["knowledge", "languages", "word", "vocabulary", "vocab", "term", "meaning"],
    icon: Plus,
    dialog: AddWordDialog,
    capture: true,
    args: [
      { key: "topic", label: "Topic", kind: "link", linkType: TOPIC, required: true, hint: "The Topic it belongs to, e.g. Spanish or Philosophy." },
      { key: "term", label: "Term", kind: "text", required: true, hint: "The word or phrase itself; may be several words." },
      { key: "meaning", label: "Meaning", kind: "text", required: true, hint: "In the user's own words." },
      { key: "notes", label: "Notes", kind: "longtext" },
      { key: "origin", label: "Where it was met", kind: "text" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const topic = await openTopic(a.topic as string);
      const term = a.term as string;
      const twin = (await allWords()).find((w) => w.languageId === topic.id && same(w.term, term));
      if (twin) throw new Error(`“${twin.term}” is already a ${topic.title} word; tell the user — nothing was changed`);
      const id = await addWord({ languageId: topic.id, term, meaning: a.meaning as string, notes: a.notes as string | undefined, origin: a.origin as string | undefined, tags: a.tags as string[] | undefined });
      return { id, message: `${term.trim()} added to ${topic.title}` };
    },
  },
  {
    id: "knowledge.sentence",
    title: "Add sentence…",
    keywords: ["knowledge", "languages", "sentence", "cloze", "blank", "phrase"],
    icon: TextCursorInput,
    dialog: AddSentenceDialog,
    capture: true,
    args: [
      { key: "topic", label: "Topic", kind: "link", linkType: TOPIC, required: true, hint: "The Topic it belongs to, e.g. Spanish." },
      { key: "text", label: "Sentence", kind: "longtext", required: true, hint: "Each blank in double braces: Tengo {{ganas}} de ir." },
      { key: "translation", label: "Translation", kind: "text", hint: "Shown with every Prompt, so each blank has one answer." },
      { key: "origin", label: "Where it was met", kind: "text" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const topic = await openTopic(a.topic as string);
      const text = a.text as string;
      const twin = (await allSentences()).find((s) => s.languageId === topic.id && same(s.text, text));
      if (twin) throw new Error(`That sentence is already in ${topic.title}; tell the user — nothing was changed`);
      const id = await addSentence({ languageId: topic.id, text, translation: a.translation as string | undefined, origin: a.origin as string | undefined, tags: a.tags as string[] | undefined });
      const blanks = (text.match(/\{\{\s*\S.*?\}\}/g) ?? []).length;
      return { id, message: `Sentence added to ${topic.title} · ${blanks} prompt${blanks === 1 ? "" : "s"}` };
    },
  },
  {
    // Headless, like every capture Command — but only for what the user dictates
    // word for word: no caller drafts a question or answer (CONTEXT.md "Knowledge").
    id: "knowledge.fact",
    title: "Keep a fact…",
    keywords: ["knowledge", "fact", "question", "answer", "history", "science", "philosophy", "remember"],
    icon: MessageCircleQuestion,
    dialog: AddFactDialog,
    capture: true,
    args: [
      { key: "topic", label: "Topic", kind: "link", linkType: TOPIC, required: true, hint: "The Topic it belongs to, e.g. History." },
      { key: "question", label: "Question", kind: "text", required: true, hint: "Exactly as the user worded it — never drafted for them." },
      { key: "answer", label: "Answer", kind: "longtext", required: true, hint: "Exactly as the user worded it — never drafted for them." },
      { key: "notes", label: "Notes", kind: "longtext" },
      { key: "origin", label: "Where it was met", kind: "text" },
      { key: "tags", label: "Tags", kind: "list" },
    ],
    async invoke(a) {
      const topic = await openTopic(a.topic as string);
      const question = a.question as string;
      const twin = (await allFacts()).find((f) => f.languageId === topic.id && same(f.question, question));
      if (twin) throw new Error(`That question is already a ${topic.title} fact; tell the user — nothing was changed`);
      const id = await addFact({ languageId: topic.id, question, answer: a.answer as string, notes: a.notes as string | undefined, origin: a.origin as string | undefined, tags: a.tags as string[] | undefined });
      return { id, message: `Fact kept in ${topic.title}` };
    },
  },
  { id: "knowledge.practise", title: "Practise", keywords: ["knowledge", "practice", "practise", "review", "recall", "flashcards"], icon: Play, run: ({ navigate }) => navigate(KNOWLEDGE_HREF) },
  { id: "knowledge.open", title: "Go to Knowledge", keywords: ["knowledge", "topics", "words", "decks"], icon: Brain, run: ({ navigate }) => navigate(KNOWLEDGE_HREF) },
];
