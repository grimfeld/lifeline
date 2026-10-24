import { useMemo, useState } from "react";
import { openPeek } from "@lifeline/core";
import { Badge, Button, Card, CardContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, PhoneDock, PhoneFilters, cn, usePhone } from "@lifeline/ui";
import { MessageCircleQuestion, Pause, Play, Plus, Search, TextCursorInput, WholeWord } from "lucide-react";
import { heldPrompts } from "../domain/practice";
import { itemLines, itemMaterial } from "../domain/prompts";
import { FACT, SENTENCE, WORD, type Deck, type Fact, type Item, type Recall, type Sentence, type Word } from "../domain/types";
import { setPaused, type MaterialDoc } from "../data/repo";
import { WordDialog } from "../components/WordDialog";
import { SentenceDialog } from "../components/SentenceDialog";
import { FactDialog } from "../components/FactDialog";

type Filter = "all" | "words" | "sentences" | "facts" | "paused";

/** The soonest any of an item's Prompts is due — "new" while none has a Recall. */
function nextHint(dues: (Date | null)[], now: Date): string {
  const known = dues.filter((d): d is Date => !!d);
  if (!known.length) return "new";
  const soonest = Math.min(...known.map((d) => d.getTime()));
  const days = Math.round((soonest - now.getTime()) / 86_400_000);
  if (soonest <= now.getTime()) return "due";
  return days < 1 ? "today" : days === 1 ? "tomorrow" : `in ${days} d`;
}

/** Everything kept in the active Topic — Words, Sentences, Facts: search, a Deck, paused — and the way in to add more. */
export function WordsTab({ items, others = [], decks, recalls }: { items: Item[]; others?: MaterialDoc[]; decks: Deck[]; recalls: Recall[] }) {
  const phone = usePhone();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [deckId, setDeckId] = useState("");
  const [addingWord, setAddingWord] = useState(false);
  const [addingSentence, setAddingSentence] = useState(false);
  const [addingFact, setAddingFact] = useState(false);
  const [editing, setEditing] = useState<Item | undefined>();

  // eslint-disable-next-line react-hooks/exhaustive-deps -- re-read the clock whenever a Recall lands
  const now = useMemo(() => new Date(), [recalls]);
  const dues = useMemo(() => {
    const m = new Map<string, (Date | null)[]>();
    for (const p of heldPrompts(items.map(itemMaterial), recalls)) m.set(p.itemId, [...(m.get(p.itemId) ?? []), p.held.due]);
    return m;
  }, [items, recalls]);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const deck = decks.find((d) => d.id === deckId);
    return items
      .filter((i) => (filter === "words" ? i.type === WORD : filter === "sentences" ? i.type === SENTENCE : filter === "facts" ? i.type === FACT : filter === "paused" ? i.paused : true))
      .filter((i) => !deck || deck.members.includes(i.id))
      .filter((i) => {
        if (!q) return true;
        const { main, sub } = itemLines(i);
        return `${main} ${sub}`.toLocaleLowerCase().includes(q);
      })
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }, [items, decks, query, filter, deckId]);

  const chips: [Filter, string][] = [
    ["all", "All"],
    ["words", "Words"],
    ["sentences", "Sentences"],
    ["facts", "Facts"],
    ["paused", "Paused"],
  ];

  return (
    <div className="grid gap-3">
      <PhoneDock>
        <div className="flex flex-wrap items-center gap-2 max-md:contents">
          {/* A real starting width on a phone: the dock lets items shrink to nothing, and a search box must not. */}
          <div className="relative min-w-40 flex-1 max-md:basis-28">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="pl-8" />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size={phone ? "icon" : "default"} aria-label="Add" title="Add a word, sentence or fact">
                <Plus /> {!phone && "Add"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setAddingWord(true)}>
                <WholeWord /> Word
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAddingSentence(true)}>
                <TextCursorInput /> Sentence
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setAddingFact(true)}>
                <MessageCircleQuestion /> Fact
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <PhoneFilters active={(filter === "all" ? 0 : 1) + (deckId ? 1 : 0)}>
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
        </PhoneFilters>
      </PhoneDock>

      {shown.length === 0 ? (
        items.length === 0 && others.length > 0 ? null : (
          <p className="text-muted-foreground text-sm">{items.length === 0 ? "Nothing kept here yet — add a word, a sentence or a fact." : "Nothing matches."}</p>
        )
      ) : (
        <Card className="py-0">
          <CardContent className="grid gap-0.5 px-2 py-2">
            {shown.map((i) => {
              const { main, sub } = itemLines(i);
              return (
                <div key={i.id} className={cn("hover:bg-accent/50 flex items-center gap-2 rounded-sm px-1 py-1 text-sm", i.paused && "opacity-60")}>
                  <button className="grid min-w-0 flex-1 text-left" onClick={() => setEditing(i)}>
                    <span className="truncate font-medium">{main}</span>
                    {sub && <span className="text-muted-foreground truncate text-xs">{sub}</span>}
                  </button>
                  {i.type !== WORD && <Badge variant="outline">{i.type === SENTENCE ? "sentence" : "fact"}</Badge>}
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

      {others.length > 0 && (
        <section className="grid gap-1.5">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Also kept here</h2>
          <Card className="py-0">
            <CardContent className="grid gap-0.5 px-2 py-2">
              {others.map((m) => (
                <button key={m.id} className={cn("hover:bg-accent/50 flex min-w-0 items-center gap-2 rounded-sm px-1 py-1.5 text-left text-sm", !m.live && "opacity-60")} onClick={() => openPeek(m.id)}>
                  <span className="min-w-0 flex-1 truncate">{m.title || "Untitled"}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">{m.live ? "" : "not kept"}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <WordDialog open={addingWord} onOpenChange={setAddingWord} />
      <SentenceDialog open={addingSentence} onOpenChange={setAddingSentence} />
      <FactDialog open={addingFact} onOpenChange={setAddingFact} />
      <WordDialog open={editing?.type === WORD} onOpenChange={(o) => !o && setEditing(undefined)} word={editing?.type === WORD ? (editing as Word) : undefined} />
      <FactDialog open={editing?.type === FACT} onOpenChange={(o) => !o && setEditing(undefined)} fact={editing?.type === FACT ? (editing as Fact) : undefined} />
      <SentenceDialog open={!!editing && editing.type === SENTENCE} onOpenChange={(o) => !o && setEditing(undefined)} sentence={editing && editing.type === SENTENCE ? (editing as Sentence) : undefined} />
    </div>
  );
}
