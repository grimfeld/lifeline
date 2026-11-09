import type { CommandDef, CommandDialogProps } from "@lifeline/core";
import { Brain, MessageCircleQuestion, PencilLine, Play, Plus, TextCursorInput } from "lucide-react";
import { TOPIC, KNOWLEDGE_HREF, WORD, SENTENCE, FACT, type Item } from "./domain/types";
import { fieldOf, KIND_NAME, kindsWith, REWRITABLE, REWRITABLE_FIELDS, REWRITABLE_KEYS, type DraftChange } from "./domain/draft";
import type { InvokeContext } from "@lifeline/core";
import { blankSlots } from "./domain/cloze";
import { addFact, addSentence, addWord, allFacts, allTopics, allSentences, allWords, deckNamed, saveDraftChange, setMembership, updateItem } from "./data/repo";

/** A headless add goes into a Topic still in use (not archived): named, never the device’s active one. */
async function openTopic(id: string) {
  const topic = (await allTopics()).find((l) => l.id === id)!;
  if (topic.archived) throw new Error(`${topic.title} is archived`);
  return topic;
}

/**
 * What an agent's capture leaves (ADR 0115): always a draft, whatever it passes,
 * its origin naming the drafter, the lesson (the Deck) and the caller's own note.
 */
function drafting(ctx: InvokeContext | undefined, a: Record<string, unknown>): { draft?: true; origin: string | undefined } {
  const origin = a.origin as string | undefined;
  if (!ctx?.agent) return { origin };
  return { draft: true, origin: ["Agent draft", (a.deck as string | undefined)?.trim(), origin?.trim()].filter(Boolean).join(" · ") };
}

/** File a new item in the Deck named, made in its Topic when absent — a lesson (ADR 0115). */
async function fileInDeck(topicId: string, itemId: string, deck: unknown): Promise<void> {
  const name = typeof deck === "string" ? deck.trim() : "";
  if (!name) return;
  await setMembership(await deckNamed(topicId, name), { id: itemId, languageId: topicId }, true);
}

const DECK_ARG = { key: "deck", label: "Deck", kind: "text", hint: "The Deck (a lesson) to file it in; made in the Topic if it is not there yet." } as const;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
import { WordDialog } from "./components/WordDialog";
import { SentenceDialog } from "./components/SentenceDialog";
import { FactDialog } from "./components/FactDialog";

function AddWordDialog(props: CommandDialogProps) {
  return <WordDialog {...props} />;
}

function AddSentenceDialog(props: CommandDialogProps) {
  return <SentenceDialog {...props} />;
}

function AddFactDialog(props: CommandDialogProps) {
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
      { key: "term", label: "Term", kind: "text", required: true, hint: "The word or phrase itself; may be several words. Through MCP this makes a draft the user accepts before it is practised." },
      { key: "meaning", label: "Meaning", kind: "text", required: true, hint: "In the user's own words." },
      { key: "notes", label: "Notes", kind: "longtext" },
      { key: "origin", label: "Where it was met", kind: "text", hint: "Where it came from; an agent's note on the draft." },
      DECK_ARG,
      { key: "tags", label: "Tags", kind: "list" },
    ],
    returnsDocument: true,
    async invoke(a, ctx) {
      const topic = await openTopic(a.topic as string);
      const term = a.term as string;
      const twin = (await allWords()).find((w) => w.languageId === topic.id && same(w.term, term));
      if (twin) throw new Error(`“${twin.term}” is already a ${topic.title} word; tell the user — nothing was changed`);
      const id = await addWord({ languageId: topic.id, term, meaning: a.meaning as string, notes: a.notes as string | undefined, ...drafting(ctx, a), tags: a.tags as string[] | undefined });
      await fileInDeck(topic.id, id, a.deck);
      return { id, message: `${term.trim()} ${ctx?.agent ? "drafted in" : "added to"} ${topic.title}` };
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
      { key: "text", label: "Sentence", kind: "longtext", required: true, hint: "Each blank in double braces: Tengo {{ganas}} de ir. A hint for the gap after a bar: Vado {{nel|in}} centro. Through MCP this makes a draft the user accepts before it is practised." },
      { key: "translation", label: "Translation", kind: "text", hint: "Shown with every Prompt, so each blank has one answer." },
      { key: "notes", label: "Notes", kind: "longtext", hint: "The rule that settles a blank, or an equally right alternative (also: in centro); shown on every reveal." },
      { key: "origin", label: "Where it was met", kind: "text", hint: "Where it came from; an agent's note on the draft." },
      DECK_ARG,
      { key: "tags", label: "Tags", kind: "list" },
    ],
    returnsDocument: true,
    async invoke(a, ctx) {
      const topic = await openTopic(a.topic as string);
      const text = a.text as string;
      const twin = (await allSentences()).find((s) => s.languageId === topic.id && same(s.text, text));
      if (twin) throw new Error(`That sentence is already in ${topic.title}; tell the user — nothing was changed`);
      const id = await addSentence({ languageId: topic.id, text, translation: a.translation as string | undefined, notes: a.notes as string | undefined, ...drafting(ctx, a), tags: a.tags as string[] | undefined });
      const blanks = blankSlots(text).length;
      await fileInDeck(topic.id, id, a.deck);
      return { id, message: `Sentence ${ctx?.agent ? "drafted in" : "added to"} ${topic.title} · ${blanks} prompt${blanks === 1 ? "" : "s"}` };
    },
  },
  {
    // Headless, like every capture Command. An agent's call is always a draft (ADR 0115):
    // the user accepts it before it is practised.
    id: "knowledge.fact",
    title: "Keep a fact…",
    keywords: ["knowledge", "fact", "question", "answer", "history", "science", "philosophy", "remember"],
    icon: MessageCircleQuestion,
    dialog: AddFactDialog,
    capture: true,
    args: [
      { key: "topic", label: "Topic", kind: "link", linkType: TOPIC, required: true, hint: "The Topic it belongs to, e.g. History." },
      { key: "question", label: "Question", kind: "text", required: true, hint: "What is asked. Through MCP this makes a draft the user accepts before it is practised." },
      { key: "answer", label: "Answer", kind: "longtext", required: true },
      { key: "notes", label: "Notes", kind: "longtext" },
      { key: "origin", label: "Where it was met", kind: "text", hint: "Where it came from; an agent's note on the draft." },
      DECK_ARG,
      { key: "tags", label: "Tags", kind: "list" },
    ],
    returnsDocument: true,
    async invoke(a, ctx) {
      const topic = await openTopic(a.topic as string);
      const question = a.question as string;
      const twin = (await allFacts()).find((f) => f.languageId === topic.id && same(f.question, question));
      if (twin) throw new Error(`That question is already a ${topic.title} fact; tell the user — nothing was changed`);
      const id = await addFact({ languageId: topic.id, question, answer: a.answer as string, notes: a.notes as string | undefined, ...drafting(ctx, a), tags: a.tags as string[] | undefined });
      await fileInDeck(topic.id, id, a.deck);
      return { id, message: ctx?.agent ? `Fact drafted in ${topic.title}` : `Fact kept in ${topic.title}` };
    },
  },
  {
    // Headless only. An agent never edits accepted material (ADR 0115): it drafts a change, the user accepts or discards it.
    id: "knowledge.draft-change",
    title: "Draft a change…",
    keywords: ["knowledge", "draft", "rewrite", "change", "fix", "word", "sentence", "fact"],
    icon: PencilLine,
    args: [
      { key: "id", label: "Item", kind: "link", linkType: [WORD, SENTENCE, FACT], required: true, hint: "The Word, Sentence or Fact to rewrite. It is never changed: the user sees your values beside its own and accepts or discards them. A newer draft change replaces an older one. A draft is simply updated." },
      ...REWRITABLE_KEYS.map((key) => ({ key, label: REWRITABLE_FIELDS[key].label, kind: REWRITABLE_FIELDS[key].long ? ("longtext" as const) : ("text" as const), hint: [`${kindsWith(key)} only`, REWRITABLE_FIELDS[key].hint].filter(Boolean).join("; ") + "." })),
    ],
    returnsDocument: true,
    async invoke(a) {
      const item = [...(await allWords()), ...(await allSentences()), ...(await allFacts())].find((i) => i.id === a.id);
      if (!item) throw new Error("That is no Word, Sentence or Fact");
      const kind = KIND_NAME[item.type];
      const wrong = REWRITABLE_KEYS.filter((k) => a[k] !== undefined && !REWRITABLE[item.type].includes(k));
      if (wrong.length) throw new Error(`${wrong.join(", ")} ${wrong.length === 1 ? "is" : "are"} not a field of a ${kind}; nothing was drafted`);
      const given: DraftChange = {};
      for (const k of REWRITABLE[item.type]) if (typeof a[k] === "string" && a[k].trim() !== fieldOf(item, k)) given[k] = a[k];
      if (!Object.keys(given).length) throw new Error("There is nothing to change: no field differs from the item’s own; nothing was drafted");
      if (item.draft) {
        await updateItem(item, { ...item, ...given } as Item);
        return { id: item.id, message: `${kind} draft updated` };
      }
      await saveDraftChange(item, given);
      return { id: item.id, message: `Change to the ${kind.toLowerCase()} drafted — the user accepts or discards it` };
    },
  },
  { id: "knowledge.practise", title: "Practise everything", keywords: ["knowledge", "practice", "practise", "review", "recall", "due", "flashcards"], icon: Play, run: ({ navigate }) => navigate(`${KNOWLEDGE_HREF}?practice=all`) },
  { id: "knowledge.open", title: "Go to Knowledge", keywords: ["knowledge", "topics", "words", "decks"], icon: Brain, run: ({ navigate }) => navigate(KNOWLEDGE_HREF) },
];
