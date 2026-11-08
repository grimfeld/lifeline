import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, Textarea, toast } from "@lifeline/ui";
import { saveAddress } from "../data/addresses";
import { message } from "./writes";
import type { Address } from "../domain/types";

/**
 * Add or change an Address (#418). The lookup runs on save (`saveAddress`)
 * and nowhere else: not on render, not in the store. When it finds nothing or
 * fails, the Address is saved all the same, with no coordinates, and the page
 * offers the lookup again.
 */
export function AddressDialog({ personId, address, open, onOpenChange }: { personId: string; address?: Address; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(address?.label ?? "");
    setText(address?.text ?? "");
    setError("");
  }, [open, address]);

  async function save() {
    setBusy(true);
    try {
      const placed = await saveAddress(personId, address, { label, text });
      if (!placed) toast.success("Address saved. No place was found for it yet: try the lookup again from the Address.");
      onOpenChange(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{address ? "Change address" : "Add an address"}</DialogTitle>
          <DialogDescription>Its place is looked up when you save, to put it on the map.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Label">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home, Work, Holiday house" autoFocus autoComplete="off" />
          </Field>
          <Field label="Address" error={error || undefined}>
            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError("");
              }}
              rows={3}
              placeholder="12 Rue Example, 75001 Paris"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !text.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
