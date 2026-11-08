import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useDocuments } from "@lifeline/core";
import { Button, Combobox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, toast, type ComboboxOption } from "@lifeline/ui";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { personHref } from "../constants";
import { PERSON, type Person } from "../domain/types";
import { tiesSeenFrom, type TieRow } from "../domain/ties";
import { addTie, removeTie, updateTie, useTies } from "../data/ties";
import { Section } from "./sections";

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Add or edit a Tie from `person`'s page (#404 stories 17-20): the other
 * Person by name completion (fixed when editing), then a word for each end.
 * The words are as the Tie reads from this page: what they are to me, what I
 * am to them.
 */
function TieDialog({ person, row, onOpenChange }: { person: Person; row?: TieRow; onOpenChange: (open: boolean) => void }) {
  const people = useDocuments<Person>(PERSON);
  const [otherId, setOtherId] = useState(row?.otherId ?? "");
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState(row?.label ?? "");
  const [ownLabel, setOwnLabel] = useState(row?.ownLabel ?? "");
  const [error, setError] = useState("");
  const options = useMemo<ComboboxOption[]>(
    () => people.filter((p) => p.id !== person.id).map((p) => ({ value: p.id, label: p.title, keywords: p.aliases ?? [], description: p.relationship || undefined })),
    [people, person.id],
  );
  const otherName = people.find((p) => p.id === otherId)?.title ?? row?.otherName ?? "";

  async function save() {
    try {
      if (row) await updateTie(row.id, person.id, { label, ownLabel });
      else {
        if (!otherId) return setError("Pick the other person.");
        await addTie({ from: person.id, to: otherId, label: ownLabel, toLabel: label });
      }
      onOpenChange(false);
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{row ? "Edit tie" : "Add a tie"}</DialogTitle>
          <DialogDescription>How {person.title} and the other person stand to each other, in your own words.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Other person">
            {row || otherId ? (
              <div className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 truncate text-sm">{otherName}</span>
                {!row && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setOtherId("")}>
                    Change
                  </Button>
                )}
              </div>
            ) : (
              <Combobox query={query} onQueryChange={setQuery} options={options} onValueChange={(v) => setOtherId(v)} limit={6} listLabel="People" leading={<Search />} placeholder="Name…" autoFocus />
            )}
          </Field>
          <Field label={otherName ? `${otherName} is my…` : "They are my…"} error={error || undefined}>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="daughter" autoComplete="off" />
          </Field>
          <Field label={otherName ? `I am ${otherName}'s…` : "I am their…"}>
            <Input value={ownLabel} onChange={(e) => setOwnLabel(e.target.value)} placeholder="mother" autoComplete="off" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{row ? "Save" : "Add"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** The Person page's Ties section (#404 story 69): each Tie read from this side, the other Person a link. */
export function TiesSection({ person }: { person: Person }) {
  const ties = useTies();
  const people = useDocuments<Person>(PERSON);
  const rows = useMemo(() => tiesSeenFrom(person.id, ties, people), [person.id, ties, people]);
  const [editing, setEditing] = useState<TieRow | "new" | null>(null);

  return (
    <Section title="Ties">
      {rows.length === 0 && <p className="text-muted-foreground text-sm">No ties yet.</p>}
      <ul className="grid min-w-0 gap-1">
        {rows.map((r) => (
          <li key={r.id} className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 flex-1 break-words text-sm">
              <span className="text-muted-foreground">{r.label}: </span>
              <Link to={personHref(r.otherId)} className="underline-offset-2 hover:underline">
                {r.otherName}
              </Link>
            </span>
            <Button size="icon-xs" variant="ghost" aria-label={`Edit tie with ${r.otherName}`} onClick={() => setEditing(r)}>
              <Pencil />
            </Button>
            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Remove tie with ${r.otherName}`}
              onClick={() => void removeTie(r.id).catch((e) => toast.error(message(e)))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
          <Plus /> Add tie
        </Button>
      </div>
      {editing && <TieDialog person={person} row={editing === "new" ? undefined : editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </Section>
  );
}
