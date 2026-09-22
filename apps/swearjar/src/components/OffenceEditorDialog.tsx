import { useEffect, useState } from "react";
import { Button, COLOR_SLOTS, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, TagInput, cn, colorVar, toast, type ColorSlot } from "@lifeline/ui";
import { useTagVocabulary } from "@lifeline/core";
import { EMOJI_PRESETS, faceColor, faceOf, firstGrapheme, type Offence } from "../domain/types";
import { editAmount, formatCents, parseAmount } from "../domain/money";
import { addOffence, deleteOffence, setOffenceArchived, updateOffence } from "../data/repo";

/**
 * New / edit Offence (ADR 0054): a name, a price, a face. Repricing says so
 * out loud — it only changes the Fines still to come. A used Offence offers
 * Archive where an unused one offers Delete.
 */
export function OffenceEditorDialog({ open, onOpenChange, offence, fineCount = 0 }: { open: boolean; onOpenChange: (open: boolean) => void; offence?: Offence; fineCount?: number }) {
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState<ColorSlot | "">("");
  const [tags, setTags] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(offence?.name ?? "");
    setPrice(offence ? editAmount(offence.price) : "");
    setEmoji(offence?.emoji ?? "");
    setColor(offence?.color ?? "");
    setTags(offence?.tags ?? []);
    setConfirmDelete(false);
  }, [open, offence]);

  const cents = parseAmount(price);
  const repriced = offence && cents !== null && cents > 0 && Math.abs(cents) !== offence.price;

  async function save() {
    if (cents === null || cents <= 0) return void toast.error("Price must be above zero");
    const input = { name, price: Math.abs(cents), emoji, color, tags };
    try {
      if (offence) {
        await updateOffence(offence, input);
        toast.success("Offence updated");
      } else {
        await addOffence(input);
        toast.success(`${name.trim()} · ${formatCents(Math.abs(cents))}`);
      }
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    onOpenChange(false);
  }

  async function archive() {
    if (!offence) return;
    await setOffenceArchived(offence.id, !offence.archived);
    toast.success(offence.archived ? `${offence.name} is back` : `${offence.name} archived — its past fines stay`);
    onOpenChange(false);
  }

  async function remove() {
    if (!offence) return;
    if (!confirmDelete) return void setConfirmDelete(true);
    try {
      await deleteOffence(offence.id);
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    toast.success("Offence deleted");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{offence ? "Edit offence" : "New offence"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="of-name">Name</Label>
              <Input id="of-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Snoozed the alarm" autoFocus onKeyDown={(e) => e.key === "Enter" && void save()} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="of-price">Price</Label>
              <Input id="of-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="2" inputMode="decimal" onKeyDown={(e) => e.key === "Enter" && void save()} />
            </div>
          </div>
          {repriced && <p className="text-muted-foreground text-xs">Fines already logged keep {formatCents(offence.price)} — only the next ones cost {formatCents(Math.abs(cents))}.</p>}
          <div className="grid gap-2">
            <Label htmlFor="of-emoji">Face</Label>
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-full text-2xl leading-none text-white" style={{ background: faceColor({ color }) }}>
                {faceOf({ name, emoji })}
              </span>
              <div className="grid min-w-0 flex-1 gap-2">
                <Input id="of-emoji" value={emoji} onChange={(e) => setEmoji(firstGrapheme(e.target.value))} placeholder="🤬 — or the name's first letter" />
                <div className="flex flex-wrap gap-1">
                  {EMOJI_PRESETS.map((e) => (
                    <button key={e} type="button" aria-label={e} aria-pressed={emoji === e} onClick={() => setEmoji(emoji === e ? "" : e)} className={cn("hover:bg-accent size-8 rounded-md text-lg leading-none", emoji === e && "bg-accent ring-foreground/40 ring-1")}>
                      {e}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" aria-label="No colour" aria-pressed={color === ""} onClick={() => setColor("")} className={cn("text-muted-foreground size-7 rounded-full border-2 border-dashed text-xs transition-transform", color === "" ? "border-foreground scale-110" : "border-muted-foreground/50")}>
                    —
                  </button>
                  {COLOR_SLOTS.map((c) => (
                    <button key={c} type="button" aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)} className={cn("size-7 rounded-full border-2 transition-transform", color === c ? "border-foreground scale-110" : "border-transparent")} style={{ background: colorVar(c) }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {offence ? (
            fineCount > 0 ? (
              <Button variant="ghost" onClick={() => void archive()}>
                {offence.archived ? "Unarchive" : "Archive"}
              </Button>
            ) : (
              <Button variant={confirmDelete ? "destructive" : "ghost"} onClick={() => void remove()}>
                {confirmDelete ? "Really delete" : "Delete"}
              </Button>
            )
          ) : (
            <span />
          )}
          <Button onClick={() => void save()}>{offence ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
