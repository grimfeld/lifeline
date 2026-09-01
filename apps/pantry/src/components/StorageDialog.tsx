import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { STORAGE_KINDS, type Storage, type StorageKind } from "../domain/types";
import { KIND_LABELS } from "../domain/rules";
import { addStorage, patchStorage, removeStorageIfEmpty } from "../data/repo";

/** Add or edit one Storage. Deleting is refused while anything is stored in it. */
export function StorageDialog({ open, onOpenChange, storage }: { open: boolean; onOpenChange: (o: boolean) => void; storage?: Storage | null }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<StorageKind>("shelf");

  useEffect(() => {
    if (!open) return;
    setTitle(storage?.title ?? "");
    setKind(storage?.kind ?? "shelf");
  }, [open, storage]);

  async function save() {
    const t = title.trim();
    if (!t) return;
    if (storage) await patchStorage(storage.id, { title: t, kind });
    else await addStorage(t, kind);
    onOpenChange(false);
  }

  async function remove() {
    if (!storage) return;
    const gone = await removeStorageIfEmpty(storage.id);
    if (!gone) {
      toast.error(`${storage.title} still holds provisions — move or delete them first`);
      return;
    }
    toast.success(`${storage.title} removed`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{storage ? storage.title : "New storage"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="storage-title">Name</Label>
            <Input id="storage-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chest freezer" autoFocus onKeyDown={(e) => e.key === "Enter" && void save()} />
          </div>
          <div className="grid gap-1.5">
            <Label>Kind</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as StorageKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STORAGE_KINDS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="gap-2">
          {storage ? (
            <Button type="button" variant="destructive" onClick={() => void remove()}>
              Delete
            </Button>
          ) : null}
          <Button type="button" disabled={!title.trim()} onClick={() => void save()}>
            {storage ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
