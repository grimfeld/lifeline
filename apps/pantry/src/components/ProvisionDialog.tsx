import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import type { Provision } from "../domain/types";
import { clampQty } from "../domain/rules";
import { addProvision, deleteProvision, patchProvision, useStorages } from "../data/repo";

/** Add or edit one Provision. Tags stay with the generic tools; this is the counter's form. */
export function ProvisionDialog({
  open,
  onOpenChange,
  provision,
  defaultStorageId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  provision?: Provision | null;
  defaultStorageId?: string;
}) {
  const storages = useStorages();
  const [title, setTitle] = useState("");
  const [storageId, setStorageId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unit, setUnit] = useState("");
  const [minimum, setMinimum] = useState("");
  const [expires, setExpires] = useState("");
  const [frozenOn, setFrozenOn] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(provision?.title ?? "");
    setStorageId(provision?.storageId ?? defaultStorageId ?? storages[0]?.id ?? "");
    setQuantity(String(provision?.quantity ?? 1));
    setUnit(provision?.unit ?? "");
    setMinimum(provision && provision.minimum > 0 ? String(provision.minimum) : "");
    setExpires(provision?.expires ?? "");
    setFrozenOn(provision?.frozenOn ?? "");
    // storages load async; re-defaulting on their arrival is wanted for a fresh form
  }, [open, provision, defaultStorageId, storages]);

  const canSave = !!title.trim() && !!storageId;

  async function save() {
    if (!canSave) return;
    const patch = {
      title: title.trim(),
      storageId,
      quantity: clampQty(Number(quantity) || 0),
      unit: unit.trim(),
      minimum: clampQty(Number(minimum) || 0),
      expires,
      frozenOn,
    };
    if (provision) await patchProvision(provision.id, patch);
    else await addProvision(patch);
    onOpenChange(false);
  }

  async function remove() {
    if (!provision) return;
    await deleteProvision(provision.id);
    toast.success(`${provision.title} — gone from the pantry`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{provision ? provision.title : "New provision"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="pantry-title">Product</Label>
            <Input id="pantry-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chicken breast" autoFocus onKeyDown={(e) => e.key === "Enter" && void save()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Storage</Label>
              <Select value={storageId} onValueChange={setStorageId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pick a storage" />
                </SelectTrigger>
                <SelectContent>
                  {storages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pantry-unit">Unit</Label>
              <Input id="pantry-unit" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="500g pack" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pantry-qty">Quantity</Label>
              <Input id="pantry-qty" type="number" min={0} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pantry-min">Minimum (running low under)</Label>
              <Input id="pantry-min" type="number" min={0} step={1} value={minimum} onChange={(e) => setMinimum(e.target.value)} placeholder="none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="pantry-expires">Expires (check by)</Label>
              <Input id="pantry-expires" type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="pantry-frozen">Frozen on</Label>
              <Input id="pantry-frozen" type="date" value={frozenOn} onChange={(e) => setFrozenOn(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {provision ? (
            <Button type="button" variant="destructive" onClick={() => void remove()}>
              Delete
            </Button>
          ) : null}
          <Button type="button" disabled={!canSave} onClick={() => void save()}>
            {provision ? "Save" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
