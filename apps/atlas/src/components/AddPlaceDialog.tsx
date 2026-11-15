import { useEffect, useState } from "react";
import { initialText, useOpenPeek, type CommandDialogProps, type Document } from "@lifeline/core";
import { Button, ChoiceField, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, toast } from "@lifeline/ui";
import { PlaceTaken, addPlace, kindOptions } from "../data/repo";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Add a Place (ADR 0119, #487 story 1): a name, and a Kind if you like; the
 * rest goes on its page. The palette's and the capture sheet's "Add place…".
 * A name another Place has is refused, and that Place is offered instead.
 */
export function AddPlaceDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");
  const [taken, setTaken] = useState<Document>();
  const [busy, setBusy] = useState(false);
  const openPeek = useOpenPeek();

  useEffect(() => {
    if (!open) return;
    setName(initialText(initial, "name"));
    setKind("");
    setError("");
    setTaken(undefined);
  }, [open, initial]);

  async function save() {
    if (!name.trim()) return setError("A Place needs a name.");
    setBusy(true);
    try {
      const p = await addPlace({ name, kind });
      toast.success(`Added ${p.title}`);
      onOpenChange(false);
      openPeek(p.id);
    } catch (e) {
      setError(message(e));
      setTaken(e instanceof PlaceTaken ? e.existing : undefined);
    } finally {
      setBusy(false);
    }
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
          <DialogDescription>Its name, and its Kind if you like. Aliases, Tags and notes go on its page.</DialogDescription>
        </DialogHeader>
        <form
          className="grid min-w-0 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Name" error={error || undefined}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
                setTaken(undefined);
              }}
              placeholder="Chez Janou"
              autoFocus
              autoComplete="off"
            />
          </Field>
          {taken && (
            <Button type="button" variant="secondary" className="min-w-0 justify-start" onClick={() => openTaken(taken)}>
              <span className="min-w-0 truncate">Open {taken.title}</span>
            </Button>
          )}
          <ChoiceField label="Kind" value={kind} options={kindOptions()} optional onCommit={setKind} />
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
