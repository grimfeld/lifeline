import { useEffect, useState } from "react";
import { geocode } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, Textarea, toast } from "@lifeline/ui";
import { addAddress, coordsOf, editAddress } from "../domain/addresses";
import { updateAddresses } from "../data/repo";
import type { Address } from "../domain/types";

/** Look the text up: the first hit's coordinates, or none when nothing is found or the lookup fails. */
export async function locate(text: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const hit = (await geocode(text, 1))[0];
    return hit ? { lat: hit.lat, lon: hit.lon } : null;
  } catch {
    return null;
  }
}

/**
 * Add or change an Address (#418). The lookup runs here, in the save handler
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
    if (!text.trim()) return setError("An Address needs its text.");
    setBusy(true);
    try {
      // Unchanged text keeps the coordinates it already has, found or not found.
      const found = address && address.text === text.trim() ? coordsOf(address) : await locate(text);
      if (address) await updateAddresses(personId, (list) => editAddress(list, address.id, { label, text, lat: found?.lat, lon: found?.lon }));
      else await updateAddresses(personId, (list) => addAddress(list, { label, text, ...found }, () => crypto.randomUUID()));
      if (!found) toast.success("Address saved. No place was found for it yet: try the lookup again from the Address.");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
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
