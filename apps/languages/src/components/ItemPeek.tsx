import { useMemo, useState } from "react";
import { Button, CommitField, cn, toast } from "@lifeline/ui";
import type { Document } from "@lifeline/core";
import { Pause, Pencil, Play } from "lucide-react";
import { heldPrompts } from "../domain/practice";
import { itemMaterial } from "../domain/prompts";
import { FACT, SENTENCE, WORD, type Fact, type Item, type Sentence, type Word } from "../domain/types";
import { setMembership, setPaused, updateFact, updateSentence, updateWord, useDecks, useItems, useTopicRecalls, useTopics } from "../data/repo";
import { WordDialog } from "./WordDialog";
import { SentenceDialog } from "./SentenceDialog";
import { FactDialog } from "./FactDialog";
import { OriginLine } from "./OriginLine";

function slotLabel(slot: string): string {
  if (slot === "forward") return "Forward";
  if (slot === "reverse") return "Reverse";
  return `Blank · ${slot.replace(/^blank:/, "")}`;
}

function dueLabel(d: Date | null, now: Date): string {
  if (!d) return "new";
  if (d <= now) return "due now";
  return `due ${d.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;
}

/**
 * Writes one or more of an item's own Fields through its App's update — which
 * checks them as the dialog does (a Sentence keeps a blank, a Word its
 * meaning) and keeps its Prompts (ADR 0058). The Topic is guarded and stays.
 */
function saveItem(item: Item, patch: Record<string, string>): Promise<void> {
  const base = { languageId: item.languageId, origin: item.origin, originId: item.originId, tags: item.tags };
  if (item.type === WORD) return updateWord(item, { ...base, term: item.term, meaning: item.meaning, notes: item.notes, ...patch });
  if (item.type === SENTENCE) return updateSentence(item, { ...base, text: item.text, translation: item.translation, ...patch });
  return updateFact(item, { ...base, question: item.question, answer: item.answer, notes: item.notes, ...patch });
}

/** The item's own Fields, edited in place: what is learned, its other side, notes, and where it was met unless that is a link. */
function ItemFields({ item }: { item: Item }) {
  const field = (key: string, label: string, value: string, opts: { multiline?: boolean; hint?: string } = {}) => (
    <CommitField key={key} label={label} value={value} multiline={opts.multiline} hint={opts.hint} onCommit={(v) => saveItem(item, { [key]: v })} />
  );
  return (
    <div className="grid gap-3">
      {item.type === WORD && [field("term", "Word", item.term), field("meaning", "Meaning", item.meaning)]}
      {item.type === SENTENCE && [field("text", "Sentence", item.text, { hint: "Mark each blank with {{ }}" }), field("translation", "Translation", item.translation)]}
      {item.type === FACT && [field("question", "Question", item.question), field("answer", "Answer", item.answer, { multiline: true })]}
      {!item.originId && field("origin", "Where you met it", item.origin)}
      {item.type !== SENTENCE && field("notes", "Notes", item.notes, { multiline: true })}
    </div>
  );
}

/**
 * The Knowledge Peek (ADR 0057, editable by ADR 0085): a Word, Sentence or
 * Fact seen from wherever it was opened — its own Fields edited in place,
 * where it was met, how each Prompt is held, its Decks one tap in or out, and
 * pause.
 */
export function ItemPeek({ doc }: { doc: Document }) {
  const items = useItems((doc as Item).languageId);
  const item = items.find((i) => i.id === doc.id) ?? (doc as Item);
  const recalls = useTopicRecalls(item.languageId);
  const topic = useTopics().find((l) => l.id === item.languageId);
  const decks = useDecks().filter((d) => d.languageId === item.languageId);
  const [editing, setEditing] = useState(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read the clock whenever a Recall lands
  const now = useMemo(() => new Date(), [recalls]);
  const prompts = useMemo(() => heldPrompts([itemMaterial(item)], recalls), [item, recalls]);

  return (
    <div className="flex flex-col gap-4">
      <span className="text-muted-foreground flex flex-wrap gap-x-1 text-xs">
        <span>{topic?.name ?? "Topic"}</span>
        {item.originId && (
          <>
            <span>·</span>
            <OriginLine originId={item.originId} origin={item.origin} />
          </>
        )}
      </span>
      <ItemFields key={item.id} item={item} />
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">Prompts</span>
        <ul className="flex flex-col text-sm">
          {prompts.map((p) => (
            <li key={p.key} className="flex justify-between gap-3 border-b py-1 last:border-0">
              <span className="min-w-0 flex-1 truncate">{slotLabel(p.slot)}</span>
              <span className="text-muted-foreground text-xs">
                {item.paused ? "paused" : dueLabel(p.held.due, now)}
                {p.held.lapses ? ` · ${p.held.lapses} lapse${p.held.lapses === 1 ? "" : "s"}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </div>
      {decks.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs font-medium">Decks</span>
          <div className="flex flex-wrap gap-1.5">
            {decks.map((d) => {
              const inDeck = d.members.includes(item.id);
              return (
                <button
                  key={d.id}
                  type="button"
                  aria-pressed={inDeck}
                  onClick={() => setMembership(d, item, !inDeck).catch((e: Error) => toast.error(inDeck ? `Couldn’t take it out of ${d.name}` : `Couldn’t put it in ${d.name}`, { description: e.message }))}
                  className={cn("focus-visible:ring-ring rounded-full border px-3 py-1 text-xs focus-visible:ring-2 focus-visible:outline-none", inDeck ? "bg-accent text-accent-foreground border-transparent font-medium" : "text-muted-foreground")}>
                  {d.name}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil /> Edit
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void setPaused(item.id, !item.paused)}>
          {item.paused ? <Play /> : <Pause />} {item.paused ? "Resume" : "Pause"}
        </Button>
      </div>
      {item.type === SENTENCE && <SentenceDialog open={editing} onOpenChange={setEditing} sentence={item as Sentence} />}
      {item.type === WORD && <WordDialog open={editing} onOpenChange={setEditing} word={item as Word} />}
      {item.type === FACT && <FactDialog open={editing} onOpenChange={setEditing} fact={item as Fact} />}
    </div>
  );
}
