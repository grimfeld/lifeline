import { useEffect, useState } from "react";
import { initialText, useOpenPeek, type CommandDialogProps, type Coords, type Document } from "@lifeline/core";
import { Button, ChoiceField, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { PlaceTaken, addPlace } from "../data/repo";
import { kindOptions } from "../domain/place";
import { HereButton } from "./Here";
import { LocateButton, PlaceSearchField, WhereNote, type PlaceHit } from "./PlaceLookup";
import { message } from "./message";

/**
 * Add a Place (ADR 0119, #487 stories 1–4): a name, a Kind and an address if
 * you like; the rest goes on its page. Typing the name or the address offers
 * matching real places, and one pick fills the name, the address and the
 * coordinates; a typed address can be Located, or is looked up on Add. The
 * palette's and the capture sheet's "Add place…". A name another Place has is
 * refused, and that Place is offered instead. Here (#501) offers the places
 * around the device, or Just here: the position as the coordinates of the name typed.
 */
export function AddPlaceDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [address, setAddress] = useState("");
  const [at, setAt] = useState<Coords>();
  const [error, setError] = useState("");
  const [taken, setTaken] = useState<Document>();
  const [busy, setBusy] = useState(false);
  const openPeek = useOpenPeek();

  useEffect(() => {
    if (!open) return;
    setName(initialText(initial, "name"));
    setKind("");
    setAddress("");
    setAt(undefined);
    setError("");
    setTaken(undefined);
  }, [open, initial]);

  async function save() {
    if (!name.trim()) return setError("A Place needs a name.");
    setBusy(true);
    try {
      const p = await addPlace({ name, kind, address, at });
      toast.success(p.address && !p.geo ? `Added ${p.title}, off the map: its address was found nowhere` : `Added ${p.title}`);
      onOpenChange(false);
      openPeek(p.id);
    } catch (e) {
      setError(message(e));
      setTaken(e instanceof PlaceTaken ? e.existing : undefined);
    } finally {
      setBusy(false);
    }
  }

  function changeName(text: string) {
    setName(text);
    setError("");
    setTaken(undefined);
  }

  /** A pick from the name: its name, address and coordinates. From the address: the same, the name only when none is typed. */
  function pick(hit: PlaceHit, from: "name" | "address") {
    if (hit.name && (from === "name" || !name.trim())) changeName(hit.name);
    setAddress(hit.address);
    setAt(hit.at);
  }

  function openTaken(doc: Document) {
    onOpenChange(false);
    openPeek(doc.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a place</DialogTitle>
          <DialogDescription>Its name, and its Kind and address if you like: pick a match to fill them. Aliases, Tags and notes go on its page.</DialogDescription>
        </DialogHeader>
        <form
          className="grid min-w-0 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <PlaceSearchField label="Name" value={name} onChange={changeName} onPick={(hit) => pick(hit, "name")} placeholder="Chez Janou" autoFocus error={error} />
          <HereButton onPick={(hit) => pick(hit, "name")} onJustHere={setAt} />
          {taken && (
            <Button type="button" variant="secondary" className="min-w-0 justify-start" onClick={() => openTaken(taken)}>
              <span className="min-w-0 truncate">Open {taken.title}</span>
            </Button>
          )}
          <ChoiceField label="Kind" value={kind} options={kindOptions()} optional onCommit={setKind} />
          <div className="grid min-w-0 gap-2">
            <PlaceSearchField
              label="Address"
              value={address}
              onChange={(text) => {
                setAddress(text);
                // Typed text is no longer where the pick was: it is looked up again.
                setAt(undefined);
              }}
              onPick={(hit) => pick(hit, "address")}
              placeholder="2 Rue Roger Verlomme, Paris"
            />
            <div className="flex min-w-0 flex-wrap items-start gap-2">
              {!at && <LocateButton address={address} onFound={setAt} />}
              <WhereNote address={address} at={at} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
