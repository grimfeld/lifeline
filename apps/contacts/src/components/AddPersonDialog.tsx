import { useEffect, useState } from "react";
import { initialText, useOpenPeek, type Handoff } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, toast } from "@lifeline/ui";
import { addPerson } from "../data/repo";
import { nameFromHandoff } from "../domain/person";

/**
 * Add a Person (#404 stories 1, 2, 5): a name and nothing else — aliases, a
 * Relationship and the rest are given on their page or Peek afterwards. The
 * palette's and the capture sheet's "Add person…", and the Contacts App's
 * Intake, opened with a Handoff (a name selected in a Day). Opens the new
 * Person's Peek where the user is, unless an Intake's caller takes it from
 * here (`onSaved`).
 */
export function AddPersonDialog({ open, onOpenChange, handoff, initial, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; handoff?: Handoff; initial?: Record<string, unknown>; onSaved?: (id: string) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const openPeek = useOpenPeek();

  useEffect(() => {
    if (!open) return;
    setName(handoff ? nameFromHandoff(handoff) : initialText(initial, "name"));
    setError("");
  }, [open, handoff, initial]);

  async function save() {
    if (!name.trim()) return setError("A Person needs a name.");
    setBusy(true);
    try {
      const p = await addPerson({ name });
      toast.success(`Added ${p.title}`);
      onSaved?.(p.id);
      onOpenChange(false);
      if (!handoff) openPeek(p.id);
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
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>Just a name. Aliases, a Relationship and the rest go on their page.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
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
              }}
              placeholder="Anne Dupont"
              autoFocus
              autoComplete="off"
            />
          </Field>
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
