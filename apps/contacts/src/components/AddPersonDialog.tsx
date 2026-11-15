import { useEffect, useMemo, useState } from "react";
import { useOpenPeek, type Handoff } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, toast } from "@lifeline/ui";
import { addPerson, usePeople } from "../data/repo";
import { addMember, useHouseholds } from "../data/households";
import { householdsForFamilyName } from "../domain/households";
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
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  // Only a typed title is held; without one the shown title is composed from the names, as addPerson does (ADR 0117).
  const [typed, setTyped] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const openPeek = useOpenPeek();
  const households = useHouseholds();
  const people = usePeople();
  // The Households a Family name suggests; one joins only when tapped, and when the Person is added (ADR 0117).
  const suggested = useMemo(() => (open ? householdsForFamilyName(familyName, households, people) : []), [open, familyName, households, people]);
  const [joining, setJoining] = useState<string[]>([]);
  const prefilled = initialName(handoff, initial).trim() !== "";
  const name = typed ?? composeTitle(givenName, familyName);

  useEffect(() => {
    if (!open) return;
    const initialTitle = initialName(handoff, initial);
    setTyped(initialTitle.trim() !== "" ? initialTitle : null);
    setGivenName("");
    setFamilyName("");
    setJoining([]);
    setError("");
  }, [open, handoff, initial]);

  function setNames(given: string, family: string) {
    setGivenName(given);
    setFamilyName(family);
    setError("");
  }

  async function save() {
    if (!name.trim()) return setError("A Person needs a name.");
    setBusy(true);
    try {
      const p = await addPerson({ name: typed ?? "", givenName, familyName });
      toast.success(`Added ${p.title}`);
      // The Person is added whatever happens to a membership; a failed one is said, not silent.
      for (const h of suggested.filter((h) => joining.includes(h.id))) {
        try {
          await addMember(h.id, p.id);
        } catch (e) {
          toast.error(`${p.title} could not join ${h.title}.`, { description: message(e) });
        }
      }
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
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Given name">
              <Input value={givenName} onChange={(e) => setNames(e.target.value, familyName)} placeholder="Anne" autoComplete="off" autoFocus={!prefilled} />
            </Field>
            <Field label="Family name">
              <Input value={familyName} onChange={(e) => setNames(givenName, e.target.value)} placeholder="Dupont" autoComplete="off" />
            </Field>
          </div>
          <Field label="Name" hint="The title: made from the two names until you type it." error={error || undefined}>
            <Input
              value={name}
              onChange={(e) => {
                setTyped(e.target.value.trim() !== "" ? e.target.value : null);
                setError("");
              }}
              placeholder="Anne Dupont"
              autoComplete="off"
              autoFocus={prefilled}
            />
          </Field>
          {suggested.length > 0 && (
            <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label="Households">
              {suggested.map((h) => {
                const on = joining.includes(h.id);
                return (
                  <Button
                    key={h.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    aria-pressed={on}
                    className="h-auto min-w-0 max-w-full whitespace-normal break-words py-1 text-left"
                    onClick={() => setJoining(on ? joining.filter((id) => id !== h.id) : [...joining, h.id])}
                  >
                    {`Join ${h.title}`}
                  </Button>
                );
              })}
            </div>
          )}
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
