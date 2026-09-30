import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Input, cn } from "@lifeline/ui";
import { Pause, Play, Plus, Search } from "lucide-react";
import { plainSentence } from "../domain/cloze";
import { heldPrompts } from "../domain/practice";
import { SENTENCE, type Deck, type Item, type Recall, type Sentence, type Word } from "../domain/types";
import { setPaused } from "../data/repo";
import { WordDialog } from "../components/WordDialog";
import { SentenceDialog } from "../components/SentenceDialog";

type Filter = "all" | "words" | "sentences" | "paused";

/** The soonest any of an item's Prompts is due — "new" while none has a Recall. */
function nextHint(dues: (Date | null)[], now: Date): string {
  const known = dues.filter((d): d is Date => !!d);
  if (!known.length) return "new";
  const soonest = Math.min(...known.map((d) => d.getTime()));
  const days = Math.round((soonest - now.getTime()) / 86_400_000);
  if (soonest <= now.getTime()) return "due";
  return days < 1 ? "today" : days === 1 ? "tomorrow" : `in ${days} d`;
}

/** Every Word and Sentence of the active Language: search, a Deck, paused — and the way in to add more. */
export function WordsTab({ items, decks, recalls }: { items: Item[]; decks: Deck[]; recalls: Recall[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deckId, setDeckId] = useState("");
  const [addingWord, setAddingWord] = useState(false);
  const [addingSentence, setAddingSentence] = useState(false);
  const [editing, setEditing] = useState<Item | undefined>();

  const now = useMemo(() => new Date(), [recalls]);
  const dues = useMemo(() => {
    const m = new Map<string, (Date | null)[]>();
    for (const p of heldPrompts(items, recalls)) m.set(p.itemId, [...(m.get(p.itemId) ?? []), p.held.due]);
    return m;
  }, [items, recalls]);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const deck = decks.find((d) => d.id === deckId);
    return items
      .filter((i) => (filter === "words" ? i.type !== SENTENCE : filter === "sentences" ? i.type === SENTENCE : filter === "paused" ? i.paused : true))
      .filter((i) => !deck || deck.members.includes(i.id))
      .filter((i) => {
        if (!q) return true;
        const hay = i.type === SENTENCE ? `${plainSentence((i as Sentence).text)} ${(i as Sentence).translation}` : `${(i as Word).term} ${(i as Word).meaning}`;
        return hay.toLocaleLowerCase().includes(q);
      })
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }, [items, decks, query, filter, deckId]);

  const chips: [Filter, string][] = [
    ["all", "All"],
    ["words", "Words"],
    ["sentences", "Sentences"],
    ["paused", "Paused"],
  ];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-40 flex-1">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="pl-8" />
        </div>
        <Button variant="outline" onClick={() => setAddingSentence(true)}>
          <Plus /> Sentence
        </Button>
        <Button onClick={() => setAddingWord(true)}>
          <Plus /> Word
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full border px-3 py-1 text-xs", filter === f ? "bg-accent text-accent-foreground border-transparent font-medium" : "text-muted-foreground")}>
            {label}
          </button>
        ))}
        {decks.length > 0 && <span className="bg-border mx-1 h-4 w-px" />}
        {decks.map((d) => (
          <button key={d.id} onClick={() => setDeckId(deckId === d.id ? "" : d.id)} className={cn("rounded-full border px-3 py-1 text-xs", deckId === d.id ? "bg-accent text-accent-foreground border-transparent font-medium" : "text-muted-foreground")}>
            {d.name}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">{items.length === 0 ? "Nothing here yet — add a word you met today." : "Nothing matches."}</p>
      ) : (
        <Card className="py-0">
          <CardContent className="grid gap-0.5 px-2 py-2">
            {shown.map((i) => {
              const sentence = i.type === SENTENCE;
              const main = sentence ? plainSentence((i as Sentence).text) : (i as Word).term;
              const sub = sentence ? (i as Sentence).translation : (i as Word).meaning;
              return (
                <div key={i.id} className={cn("hover:bg-accent/50 flex items-center gap-2 rounded-sm px-1 py-1 text-sm", i.paused && "opacity-60")}>
                  <button className="grid min-w-0 flex-1 text-left" onClick={() => setEditing(i)}>
                    <span className="truncate font-medium">{main}</span>
                    {sub && <span className="text-muted-foreground truncate text-xs">{sub}</span>}
                  </button>
                  {sentence && <Badge variant="outline">sentence</Badge>}
                  <span className="text-muted-foreground w-16 shrink-0 text-right text-xs">{i.paused ? "paused" : nextHint(dues.get(i.id) ?? [], now)}</span>
                  <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => void setPaused(i.id, !i.paused)} aria-label={i.paused ? "Resume" : "Pause"} title={i.paused ? "Resume" : "Pause"}>
                    {i.paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <WordDialog open={addingWord} onOpenChange={setAddingWord} />
      <SentenceDialog open={addingSentence} onOpenChange={setAddingSentence} />
      <WordDialog open={!!editing && editing.type !== SENTENCE} onOpenChange={(o) => !o && setEditing(undefined)} word={editing && editing.type !== SENTENCE ? (editing as Word) : undefined} />
      <SentenceDialog open={!!editing && editing.type === SENTENCE} onOpenChange={(o) => !o && setEditing(undefined)} sentence={editing && editing.type === SENTENCE ? (editing as Sentence) : undefined} />
    </div>
  );
}
