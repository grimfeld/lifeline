import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import type { Need } from "../domain/types";
import { deleteNeed, saveNeed, unmarkBought } from "../data/repo";
import { AisleSelect } from "./AisleSelect";

/** Edit one Need. Renaming onto another Need's title is refused; deleting forgets it for good. */
export function NeedDialog({ open, onOpenChange, need }: { open: boolean; onOpenChange: (o: boolean) => void; need: Need | null }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [aisleId, setAisleId] = useState("");

  useEffect(() => {
    if (!open || !need) return;
    setTitle(need.title);
    setNote(need.note);
    setAisleId(need.aisleId);
  }, [open, need]);

  if (!need) return null;

  async function save() {
    if (!need || !title.trim()) return;
    const ok = await saveNeed(need.id, { title, note, aisleId });
    if (!ok) {
      toast.error(`Already have “${title.trim()}” — one Need per thing`);
      return;
    }
    onOpenChange(false);
  }

  async function remove() {
    if (!need) return;
    await deleteNeed(need.id);
    toast.success(`${need.title} — forgotten`);
    onOpenChange(false);
  }

  async function relist() {
    if (!need) return;
    await unmarkBought(need.id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{need.title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="need-edit-title">Need</Label>
            <Input id="need-edit-title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void save()} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="need-edit-note">Note</Label>
            <Input id="need-edit-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="2 L, the blue one…" onKeyDown={(e) => e.key === "Enter" && void save()} />
          </div>
          <div className="grid gap-1.5">
            <Label>Aisle</Label>
            <AisleSelect value={aisleId} onChange={setAisleId} />
          </div>
          {need.boughtOn && <div className="text-muted-foreground text-xs">Bought {need.boughtOn}</div>}
        </div>
        <DialogFooter className="gap-2">
          <Button type="button" variant="destructive" onClick={() => void remove()}>
            Delete
          </Button>
          {need.boughtOn && (
            <Button type="button" variant="outline" onClick={() => void relist()}>
              Put back on list
            </Button>
          )}
          <Button type="button" disabled={!title.trim()} onClick={() => void save()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
