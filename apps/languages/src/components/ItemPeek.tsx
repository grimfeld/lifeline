import { useMemo, useState } from "react";
import { Button, cn } from "@lifeline/ui";
import type { Document } from "@lifeline/core";
import { Pause, Pencil, Play } from "lucide-react";
import { plainSentence } from "../domain/cloze";
import { heldPrompts } from "../domain/practice";
import { itemMaterial } from "../domain/prompts";
import { SENTENCE, type Item, type Sentence, type Word } from "../domain/types";
import { setMembership, setPaused, useDecks, useItems, useTopicRecalls, useTopics } from "../data/repo";
import { WordDialog } from "./WordDialog";
import { SentenceDialog } from "./SentenceDialog";

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
 * The Knowledge Peek (ADR 0057): a Word or Sentence seen from wherever it was
 * opened — its meaning or translation, where it was met, how each Prompt is
 * held, its Decks one tap in or out, and pause.
 */
export function ItemPeek({ doc }: { doc: Document }) {
  const items = useItems((doc as Item).languageId);
  const item = items.find((i) => i.id === doc.id) ?? (doc as Item);
  const recalls = useTopicRecalls(item.languageId);
  const topic = useTopics().find((l) => l.id === item.languageId);
  const decks = useDecks().filter((d) => d.languageId === item.languageId);
  const [editing, setEditing] = useState(false);
  const now = useMemo(() => new Date(), [recalls]);
  const prompts = useMemo(() => heldPrompts([itemMaterial(item)], recalls), [item, recalls]);
  const sentence = item.type === SENTENCE;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-1">
        <span className="text-lg font-semibold">{sentence ? plainSentence((item as Sentence).text) : (item as Word).term}</span>
        <span className="text-muted-foreground">{sentence ? (item as Sentence).translation : (item as Word).meaning}</span>
        <span className="text-muted-foreground text-xs">
          {topic?.name ?? "Topic"}
          {item.origin ? ` · met: ${item.origin}` : ""}
        </span>
      </div>
      {!sentence && (item as Word).notes && <p className="text-sm whitespace-pre-wrap">{(item as Word).notes}</p>}
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
                <button key={d.id} onClick={() => void setMembership(d, item, !inDeck)} className={cn("rounded-full border px-3 py-1 text-xs", inDeck ? "bg-accent text-accent-foreground border-transparent font-medium" : "text-muted-foreground")}>
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
      {sentence ? <SentenceDialog open={editing} onOpenChange={setEditing} sentence={item as Sentence} /> : <WordDialog open={editing} onOpenChange={setEditing} word={item as Word} />}
    </div>
  );
}
