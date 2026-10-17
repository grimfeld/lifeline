import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, PhoneDock, toast } from "@lifeline/ui";
import { Layers, Plus } from "lucide-react";
import { plainSentence } from "../domain/cloze";
import { SENTENCE, type Deck, type Item, type Topic, type Sentence, type Word } from "../domain/types";
import { addDeck, deleteDeck, renameDeck, setMembership } from "../data/repo";
import { deckItems } from "./PracticeTab";

function labelOf(i: Item): string {
  return i.type === SENTENCE ? plainSentence((i as Sentence).text) : (i as Word).term;
}

/** One Deck: its name, and which of the Topic's Words and Sentences it holds — membership is the Deck's. */
function DeckDialog({ open, onOpenChange, deck, topic, items }: { open: boolean; onOpenChange: (open: boolean) => void; deck?: Deck; topic: Topic; items: Item[] }) {
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(deck?.name ?? "");
    setQuery("");
    setConfirmDelete(false);
  }, [open, deck]);

  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return items.filter((i) => !q || labelOf(i).toLocaleLowerCase().includes(q)).sort((a, b) => labelOf(a).localeCompare(labelOf(b)));
  }, [items, query]);

  async function save() {
    try {
      if (deck) {
        if (name.trim() !== deck.name) await renameDeck(deck, name);
        onOpenChange(false);
      } else {
        await addDeck(topic.id, name);
        toast.success(`${name.trim()} created — open it to choose what goes in`);
        onOpenChange(false);
      }
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove() {
    if (!deck) return;
    if (!confirmDelete) return void setConfirmDelete(true);
    await deleteDeck(deck.id);
    toast.success("Deck deleted — its words stay");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{deck ? deck.name : "New deck"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="dk-name">Name</Label>
            <Input id="dk-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Kitchen" autoFocus={!deck} onKeyDown={(e) => e.key === "Enter" && void save()} />
          </div>
          {deck && (
            <div className="grid gap-2">
              <Label>In this deck</Label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search words and sentences" />
              <div className="grid max-h-80 gap-0.5 overflow-y-auto rounded-md border p-1">
                {shown.length === 0 && <p className="text-muted-foreground p-2 text-sm">Nothing to add yet.</p>}
                {shown.map((i) => {
                  const inDeck = deck.members.includes(i.id);
                  return (
                    <label key={i.id} className="hover:bg-accent/50 flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm">
                      <Checkbox checked={inDeck} onCheckedChange={(v) => void setMembership(deck, i, v === true)} />
                      <span className="min-w-0 flex-1 truncate">{labelOf(i)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {deck ? (
            <Button variant={confirmDelete ? "destructive" : "ghost"} onClick={() => void remove()}>
              {confirmDelete ? "Really delete" : "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => void save()}>{deck ? "Done" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The active Topic's Decks: chosen sets a Practice can be narrowed to. */
export function DecksTab({ topic, decks, items }: { topic: Topic; decks: Deck[]; items: Item[] }) {
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | undefined>();
  const open = decks.find((d) => d.id === openId);

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">A deck is a set you choose, to practise on its own.</p>
        <PhoneDock>
          <Button onClick={() => setAdding(true)}>
            <Plus /> Deck
          </Button>
        </PhoneDock>
      </div>
      {decks.length === 0 ? (
        <p className="text-muted-foreground text-sm">No decks in {topic.name} yet.</p>
      ) : (
        <Card className="py-0">
          <CardContent className="grid gap-0.5 px-2 py-2">
            {decks.map((d) => (
              <button key={d.id} className="hover:bg-accent/50 flex items-center gap-3 rounded-sm px-2 py-1.5 text-left text-sm" onClick={() => setOpenId(d.id)}>
                <Layers className="text-muted-foreground size-4" />
                <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                <span className="text-muted-foreground text-xs tabular-nums">{deckItems(d, items).length}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
      <DeckDialog open={adding} onOpenChange={setAdding} topic={topic} items={items} />
      <DeckDialog open={!!open} onOpenChange={(o) => !o && setOpenId(undefined)} deck={open} topic={topic} items={items} />
    </div>
  );
}
