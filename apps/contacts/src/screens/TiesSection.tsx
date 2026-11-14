import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Button, Combobox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, type ComboboxOption } from "@lifeline/ui";
import { Link2, Search } from "lucide-react";
import { personHref } from "../constants";
import { type Person } from "../domain/types";
import { otherNameOf, tieCandidates, tieDraft, tieQuestions, tiesSeenFrom, type TieDraft, type TieRow } from "../domain/ties";
import { removeTie, restoreTie, saveTieFrom, useTies } from "../data/ties";
import { message, removeWithUndo } from "../components/writes";
import { usePeople } from "../data/repo";
import { Section } from "../components/Section";
import { AddRow, CardList, CardRow, useEditing } from "../components/Cards";

/**
 * Add or edit a Tie from `person`'s page (#404 stories 17-20): the other
 * Person by name completion (fixed when editing), then a word for each end.
 * The words are as the Tie reads from this page: what the other Person is to
 * this one, and what this one is to them. A Tie is never to me.
 */
function TieDialog({ person, row, onOpenChange }: { person: Person; row?: TieRow; onOpenChange: (open: boolean) => void }) {
  const people = usePeople();
  const [draft, setDraft] = useState(() => tieDraft(row));
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const set = (patch: Partial<TieDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const options = useMemo(() => tieCandidates(person.id, people), [people, person.id]);
  const otherName = otherNameOf(people, draft.otherId, row);
  const questions = tieQuestions(person.title, otherName);

  async function save() {
    try {
      await saveTieFrom(person.id, row, draft);
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
            <OtherPerson name={otherName} picked={draft.otherId !== ""} fixed={row !== undefined} query={query} onQueryChange={setQuery} options={options} onPick={(otherId) => set({ otherId })} />
          </Field>
          <Field label={questions.label} error={error || undefined}>
            <Input value={draft.label} onChange={(e) => set({ label: e.target.value })} placeholder="daughter" autoComplete="off" />
          </Field>
          <Field label={questions.ownLabel}>
            <Input value={draft.ownLabel} onChange={(e) => set({ ownLabel: e.target.value })} placeholder="mother" autoComplete="off" />
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

/** The Tie's other end: a name completion until one is picked, then the name (with Change, unless the Tie is being edited). */
function OtherPerson(props: { name: string; picked: boolean; fixed: boolean; query: string; onQueryChange: (q: string) => void; options: ComboboxOption[]; onPick: (id: string) => void }) {
  const { name, picked, fixed, query, onQueryChange, options, onPick } = props;
  if (!fixed && !picked) {
    return <Combobox query={query} onQueryChange={onQueryChange} options={options} onValueChange={onPick} limit={6} listLabel="People" leading={<Search />} placeholder="Name…" autoFocus />;
  }
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="min-w-0 truncate text-sm">{name}</span>
      {!fixed && (
        <Button type="button" size="sm" variant="ghost" onClick={() => onPick("")}>
          Change
        </Button>
      )}
    </div>
  );
}

/** The Person page's Ties section (#404 story 69): each Tie read from this side, the other Person a link. A card (#422). */
export function TiesSection({ person }: { person: Person }) {
  const ties = useTies();
  const people = usePeople();
  const rows = useMemo(() => tiesSeenFrom(person.id, ties, people), [person.id, ties, people]);
  const [editing, setEditing] = useState<TieRow | "new" | null>(null);
  // In Edit the row opens its dialog, so the name is no link of its own there.
  const inEdit = useEditing();

  return (
    <Section title="Ties">
      <CardList>
        {rows.length === 0 && <li className="text-muted-foreground px-3 py-2 text-sm">No ties yet.</li>}
        {rows.map((r) => (
          <CardRow
            key={r.id}
            icon={<Link2 className="size-4" />}
            title={
              <>
                <span className="text-muted-foreground">{r.label}: </span>
                {inEdit ? (
                  r.otherName
                ) : (
                  <Link to={personHref(r.otherId)} className="underline-offset-2 hover:underline">
                    {r.otherName}
                  </Link>
                )}
              </>
            }
            editLabel={`Edit ${r.label}: ${r.otherName}`}
            onEdit={() => setEditing(r)}
            removeLabel={`Remove tie with ${r.otherName}`}
            onRemove={() => void removeWithUndo(`the Tie to ${r.otherName}`, () => removeTie(r.id), restoreTie)}
          />
        ))}
        <AddRow onClick={() => setEditing("new")}>Add tie</AddRow>
      </CardList>
      {editing && <TieDialog person={person} row={editing === "new" ? undefined : editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </Section>
  );
}
