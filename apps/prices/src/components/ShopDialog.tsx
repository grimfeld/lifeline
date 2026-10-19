import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import type { Shop } from "../domain/types";
import { addShop, deleteShop, updateShop } from "../data/repo";

/** A Shop is a chain (ADR 0082): a name and a note. A referenced one cannot be deleted. */
export function ShopDialog({ open, onOpenChange, shop, defaultTitle, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; shop?: Shop | null; defaultTitle?: string; onCreated?: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(shop?.title ?? defaultTitle ?? "");
    setNote(shop?.note ?? "");
  }, [open, shop, defaultTitle]);

  async function save() {
    try {
      if (shop) await updateShop(shop, { title, note });
      else onCreated?.(await addShop({ title, note }));
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    if (!shop) return;
    try {
      await deleteShop(shop.id);
      toast.success(`${shop.title} removed`);
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{shop ? shop.title : "New shop"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="shop-title">Chain</Label>
            <Input id="shop-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lidl" autoFocus onKeyDown={(e) => e.key === "Enter" && void save()} />
            <p className="text-muted-foreground text-xs">The chain, not the branch — prices are compared per chain.</p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="shop-note">Note</Label>
            <Input id="shop-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Loyalty card in the drawer" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          {shop && (
            <Button type="button" variant="ghost" onClick={() => void remove()}>
              Delete
            </Button>
          )}
          <Button type="button" disabled={!title.trim()} onClick={() => void save()}>
            {shop ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
