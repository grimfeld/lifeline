import { useEffect, useState } from "react";
import { useOpenPeek, type Handoff } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, toast } from "@lifeline/ui";
import { addPerson } from "../data/repo";
import { composeTitle, initialName } from "../domain/person";
import { message } from "./writes";

/**
 * Add a Person (#404 stories 1, 2, 5): a name, or the two names that make it, and nothing else — aliases, a
 * Relationship and the rest are given on their page or Peek afterwards. The
 * palette's and the capture sheet's "Add person…", and the Contacts App's
 * Intake, opened with a Handoff (a name selected in a Day). Opens the new
 * Person's Peek where the user is, unless an Intake's caller takes it from
 * here (`onSaved`).
 */
export function AddPersonDialog({ open, onOpenChange, handoff, initial, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; handoff?: Handoff; initial?: Record<string, unknown>; onSaved?: (id: string) => void }) {
  const [name, setName] = useState("");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  // Once the title is typed it is the user's, and the names stop composing it (ADR 0117).
  const [typed, setTyped] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const openPeek = useOpenPeek();

  useEffect(() => {
    if (!open) return;
    const initialTitle = initialName(handoff, initial);
    setName(initialTitle);
    setTyped(initialTitle.trim() !== "");
    setGivenName("");
    setFamilyName("");
    setError("");
  }, [open, handoff, initial]);

  function setNames(given: string, family: string) {
    setGivenName(given);
    setFamilyName(family);
    if (!typed) setName(composeTitle(given, family));
    setError("");
  }

  async function save() {
    if (!name.trim()) return setError("A Person needs a name.");
    setBusy(true);
    try {
      const p = await addPerson({ name, givenName, familyName });
      toast.success(`Added ${p.title}`);
      onSaved?.(p.id);
      onOpenChange(false);
      if (!handoff) openPeek(p.id);
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
          <DialogTitle>Add a person</DialogTitle>
          <DialogDescription>A name, or a given and family name. Aliases, a Relationship and the rest go on their page.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-3 grid-cols-2">
            <Field label="Given name">
              <Input value={givenName} onChange={(e) => setNames(e.target.value, familyName)} placeholder="Anne" autoComplete="off" autoFocus />
            </Field>
            <Field label="Family name">
              <Input value={familyName} onChange={(e) => setNames(givenName, e.target.value)} placeholder="Dupont" autoComplete="off" />
            </Field>
          </div>
          <Field label="Name" hint="The title: made from the two names until you type it." error={error || undefined}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setTyped(e.target.value.trim() !== "");
                setError("");
              }}
              placeholder="Anne Dupont"
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
