import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { acceptAllReady, isDraft } from "../domain/draft";
import { itemLines } from "../domain/prompts";
import { FACT, SENTENCE, WORD, type Deck, type Fact, type Item, type Sentence, type Word } from "../domain/types";
import { acceptDraft, acceptDrafts, deleteItem } from "../data/repo";
import { WordDialog } from "./WordDialog";
import { SentenceDialog } from "./SentenceDialog";
import { FactDialog } from "./FactDialog";

/** The drafts a Deck still holds, in the order they were drafted. */
export function pendingDrafts(deck: Deck, items: Item[]): Item[] {
  const ids = new Set(deck.members);
  return items.filter((i) => ids.has(i.id) && isDraft(i)).sort((a, b) => a.addedAt.localeCompare(b.addedAt) || a.id.localeCompare(b.id));
}

/**
 * A Deck's drafts, one at a time (ADR 0115): accept, edit then accept, or delete
 * each; "Accept all" waits until every draft still pending has been shown, so a
 * long lesson is accepted in one go yet each item was seen.
 */
export function DeckReview({ deck, items, open, onOpenChange }: { deck: Deck; items: Item[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const pending = useMemo(() => pendingDrafts(deck, items), [deck, items]);
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // A fresh review each time it opens.
  useEffect(() => {
    if (!open) return;
    setAt(0);
    setShown(new Set());
    setEditing(false);
  }, [open]);

  const index = Math.min(at, Math.max(0, pending.length - 1));
  const current = pending[index] as Item | undefined;

  // The one on screen counts as shown; so does whatever replaces it after an accept or delete.
  useEffect(() => {
    setConfirmDelete(false);
    if (open && current && !shown.has(current.id)) setShown((s) => new Set(s).add(current.id));
  }, [open, current, shown]);

  const ready = acceptAllReady(pending, shown);
  const unseen = pending.filter((d) => !shown.has(d.id)).length;

  async function accept() {
    if (current) await acceptDraft(current.id);
  }

  async function remove() {
    if (!current) return;
    if (!confirmDelete) return void setConfirmDelete(true);
    await deleteItem(current.id);
    toast.success("Draft deleted");
  }

  async function acceptAll() {
    const n = pending.length;
    await acceptDrafts(pending.map((d) => d.id));
    toast.success(`${n} accepted`);
    onOpenChange(false);
  }

  const lines = current ? itemLines(current) : undefined;
  const kind = current?.type === SENTENCE ? "Sentence" : current?.type === FACT ? "Fact" : "Word";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review {deck.name}</DialogTitle>
            <DialogDescription>{current ? `Draft ${index + 1} of ${pending.length}` : "No drafts left"}</DialogDescription>
          </DialogHeader>
          {current && lines ? (
            <div className="grid gap-2" data-testid="draft-review-item">
              <p className="text-muted-foreground text-xs uppercase">{kind}</p>
              <p className="text-lg font-medium">{lines.main}</p>
              {lines.sub && <p>{lines.sub}</p>}
              {current.notes && <p className="text-muted-foreground text-sm">{current.notes}</p>}
              {current.origin && <p className="text-muted-foreground text-xs">{current.origin}</p>}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Every draft in this Deck has been dealt with.</p>
          )}
          {current && (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => setAt(index - 1)} disabled={index === 0}>
                Previous
              </Button>
              <Button variant="outline" onClick={() => setAt(index + 1)} disabled={index >= pending.length - 1}>
                Next
              </Button>
              <span className="text-muted-foreground text-xs">{unseen > 0 ? `${unseen} not shown yet` : "All shown"}</span>
            </div>
          )}
          {/* ui-allow: sm-breakpoint — a dialog footer, as DeckDialog */}
          <DialogFooter className="gap-2 sm:justify-between">
            {current ? (
              <Button variant={confirmDelete ? "destructive" : "ghost"} onClick={() => void remove()}>
                {confirmDelete ? "Really delete" : "Delete"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              {current ? (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    Edit
                  </Button>
                  <Button variant="outline" onClick={() => void acceptAll()} disabled={!ready} title={ready ? undefined : "Show every draft first"}>
                    Accept all ({pending.length})
                  </Button>
                  <Button onClick={() => void accept()}>Accept</Button>
                </>
              ) : (
                <Button onClick={() => onOpenChange(false)}>Done</Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <WordDialog open={editing && current?.type === WORD} onOpenChange={setEditing} word={current?.type === WORD ? (current as Word) : undefined} />
      <SentenceDialog open={editing && current?.type === SENTENCE} onOpenChange={setEditing} sentence={current?.type === SENTENCE ? (current as Sentence) : undefined} />
      <FactDialog open={editing && current?.type === FACT} onOpenChange={setEditing} fact={current?.type === FACT ? (current as Fact) : undefined} />
    </>
  );
}
