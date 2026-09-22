import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import type { Aisle } from "../domain/types";
import { addAisle, deleteAisle, renameAisle } from "../data/repo";

/** Add or rename an Aisle. Deleting is never blocked: its Needs become buyable anywhere. */
export function AisleDialog({ open, onOpenChange, aisle }: { open: boolean; onOpenChange: (o: boolean) => void; aisle?: Aisle | null }) {
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (open) setTitle(aisle?.title ?? "");
  }, [open, aisle]);

  async function save() {
    const t = title.trim();
    if (!t) return;
    if (aisle) await renameAisle(aisle.id, t);
    else await addAisle(t);
    onOpenChange(false);
  }

  async function remove() {
    if (!aisle) return;
    await deleteAisle(aisle.id);
    toast.success(`${aisle.title} removed — its needs are buyable anywhere`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{aisle ? aisle.title : "New aisle"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="aisle-title">Name</Label>
          <Input id="aisle-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Supermarket" autoFocus onKeyDown={(e) => e.key === "Enter" && void save()} />
        </div>
        <DialogFooter className="gap-2">
          {aisle ? (
            <Button type="button" variant="destructive" onClick={() => void remove()}>
              Delete
            </Button>
          ) : null}
          <Button type="button" disabled={!title.trim()} onClick={() => void save()}>
            {aisle ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
