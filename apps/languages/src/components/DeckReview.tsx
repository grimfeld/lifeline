import { useEffect, useMemo, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Tooltip, TooltipContent, TooltipTrigger, toast } from "@lifeline/ui";
import { acceptAllReady, deckDrafts, KIND_NAME } from "../domain/draft";
import { itemLines } from "../domain/prompts";
import { FACT, SENTENCE, WORD, type Deck, type Fact, type Item, type Sentence, type Word } from "../domain/types";
import { acceptDraft, acceptDrafts, deleteItemUndoably } from "../data/repo";
import { WordDialog } from "./WordDialog";
import { SentenceDialog } from "./SentenceDialog";
import { FactDialog } from "./FactDialog";

/**
 * A Deck's drafts, one at a time (ADR 0115): accept, edit then accept, or delete
 * each; "Accept all" waits until every draft left has been shown, so a
 * long lesson is accepted in one go yet each item was seen.
 */
export function DeckReview({ deck, items, open, onOpenChange }: { deck: Deck; items: Item[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const drafts = useMemo(() => deckDrafts(deck, items), [deck, items]);
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState(false);
  // The draft deleted last, for Undo here: the toast's Undo cannot be reached past the open dialog.
  const [deleted, setDeleted] = useState<{ item: Item; undo: () => Promise<void> } | null>(null);

  // A fresh review each time it opens.
  useEffect(() => {
    if (!open) return;
    setAt(0);
    setShown(new Set());
    setEditing(false);
    setDeleted(null);
  }, [open]);

  const index = Math.min(at, Math.max(0, drafts.length - 1));
  const current = drafts[index] as Item | undefined;

  // The one on screen counts as shown; so does whatever replaces it after an accept or delete.
  useEffect(() => {
    if (open && current && !shown.has(current.id)) setShown((s) => new Set(s).add(current.id));
  }, [open, current, shown]);

  const ready = acceptAllReady(drafts, shown);
  const unseen = drafts.filter((d) => !shown.has(d.id)).length;

  async function accept() {
    if (current) await acceptDraft(current.id);
  }

  async function remove() {
    if (!current) return;
    const gone = current;
    const del = await deleteItemUndoably(gone.id);
    setDeleted({ item: gone, undo: del.undo });
    // The clip goes once the Undo window closes, however it closes (ADR 0116).
    const close = () => {
      void del.commit();
      setDeleted((d) => (d?.item.id === gone.id ? null : d));
    };
    toast.success("Draft deleted", { action: { label: "Undo", onClick: () => void undo(gone, del.undo) }, onDismiss: close, onAutoClose: close });
  }

  async function undo(gone: Item, restore: () => Promise<void>) {
    await restore();
    setDeleted((d) => (d?.item.id === gone.id ? null : d));
  }

  async function acceptAll() {
    const n = drafts.length;
    await acceptDrafts(drafts.map((d) => d.id));
    toast.success(`${n} accepted`);
    onOpenChange(false);
  }

  const lines = current ? itemLines(current) : undefined;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review {deck.name}</DialogTitle>
            <DialogDescription>{current ? `Draft ${index + 1} of ${drafts.length}` : "No drafts left"}</DialogDescription>
          </DialogHeader>
          {current && lines ? (
            <div className="grid gap-2" data-testid="draft-review-item">
              <p className="text-muted-foreground text-xs">{KIND_NAME[current.type]}</p>
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
              <Button variant="outline" onClick={() => setAt(index + 1)} disabled={index >= drafts.length - 1}>
                Next
              </Button>
              <span className="text-muted-foreground text-xs">{unseen > 0 ? `${unseen} not shown yet` : "All shown"}</span>
            </div>
          )}
          {deleted && (
            <p className="text-muted-foreground flex min-w-0 items-center gap-1 text-sm">
              <span className="min-w-0 truncate">Deleted “{itemLines(deleted.item).main}”</span>
              <Button variant="link" size="sm" className="shrink-0" onClick={() => void undo(deleted.item, deleted.undo)}>
                Undo
              </Button>
            </p>
          )}
          {/* ui-allow: sm-breakpoint — a dialog footer, as DeckDialog */}
          <DialogFooter className="gap-2 sm:justify-between">
            {current ? (
              <Button variant="destructive" onClick={() => void remove()}>
                Delete
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
                  {ready ? (
                    <Button variant="outline" onClick={() => void acceptAll()}>
                      Accept all ({drafts.length})
                    </Button>
                  ) : (
                    // A disabled Button takes no pointer, so the tooltip sits on a focusable wrapper.
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0} className="inline-flex">
                          <Button variant="outline" disabled>
                            Accept all ({drafts.length})
                          </Button>
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>Show every draft first</TooltipContent>
                    </Tooltip>
                  )}
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
