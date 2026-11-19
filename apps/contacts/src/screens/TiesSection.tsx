import { useId, useMemo, useState } from "react";
import { Link } from "react-router";
import { Button, Combobox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, toast, type ComboboxOption } from "@lifeline/ui";
import { Link2, Search, Sparkles } from "lucide-react";
import { personHref } from "../constants";
import { type Person } from "../domain/types";
import { PRESETS, genderOf, otherNameOf, presetPressed, selectPreset, suggestedTies, tieCandidates, tieDraft, tieQuestions, tiesSeenFrom, type Preset, type SuggestedTie, type TieDraft, type TieRow } from "../domain/ties";
import { addAllSuggested, addSuggestedTie, dismissSuggestion, removeTie, restoreTie, saveTieFrom, undoDismissal, useTies } from "../data/ties";
import { message, removeWithUndo, writeOrSay } from "../components/writes";
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
  const ties = useTies();
  const gender = useMemo(() => genderOf(person.id, ties), [person.id, ties]);
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
          {(row || draft.otherId !== "") && <PresetChips draft={draft} onTap={(preset) => setDraft((d) => selectPreset(d, preset, gender))} />}
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

/** The preset chips (ADR 0130): one tap fills both words and sets the kind; the pressed one clears it. They wrap, never scroll. */
function PresetChips({ draft, onTap }: { draft: TieDraft; onTap: (preset: Preset) => void }) {
  return (
    <div role="group" aria-label="Presets" className="flex flex-wrap gap-1.5">
      {PRESETS.map((preset) => {
        const on = presetPressed(draft, preset);
        return (
          <Button key={preset.word} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => onTap(preset)}>
            {preset.word}
          </Button>
        );
      })}
    </div>
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
  const suggestions = useMemo(() => suggestedTies(person.id, ties, people), [person.id, ties, people]);
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
      <Suggested person={person} suggestions={suggestions} />
      {editing && <TieDialog person={person} row={editing === "new" ? undefined : editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </Section>
  );
}

/** "Tom is Lily's brother": a Suggested Tie read from this page. */
const sentence = (person: Person, s: SuggestedTie) => `${s.otherName} is ${person.title}'s ${s.label}`;

/**
 * The Ties card's Suggested part (ADR 0130): the Ties that follow from the
 * kinded ones, each added only on request or dismissed for good (Undo on the
 * toast). Add all at two or more. Nothing shows when there are none.
 */
function Suggested({ person, suggestions }: { person: Person; suggestions: SuggestedTie[] }) {
  const headingId = useId();
  if (suggestions.length === 0) return null;
  const dismiss = async (s: SuggestedTie) => {
    try {
      await dismissSuggestion(person.id, s);
      toast.success("Dismissed the suggestion", {
        description: sentence(person, s),
        action: { label: "Undo", onClick: () => writeOrSay("The suggestion could not be put back.", () => undoDismissal(person.id, s)) },
      });
    } catch (e) {
      toast.error("The suggestion could not be dismissed.", { description: message(e) });
    }
  };
  return (
    <div role="group" aria-labelledby={headingId} className="grid min-w-0 gap-2">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="text-muted-foreground text-sm font-medium">
          Suggested
        </h3>
        {suggestions.length >= 2 && (
          <Button size="xs" variant="secondary" onClick={() => writeOrSay("The ties could not all be added.", () => addAllSuggested(person.id, suggestions))}>
            Add all
          </Button>
        )}
      </div>
      <CardList>
        {suggestions.map((s) => (
          <li key={`${s.otherId} ${s.kind}`} className="flex min-w-0 items-center gap-3 px-3 py-2">
            <Sparkles className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 text-sm break-words">
              <Link to={personHref(s.otherId)} className="underline-offset-2 hover:underline">
                {s.otherName}
              </Link>{" "}
              <span className="text-muted-foreground">
                is {person.title}&apos;s {s.label}
              </span>
            </span>
            <span className="flex shrink-0 gap-1">
              <Button size="xs" variant="secondary" aria-label={`Add ${s.otherName} as ${person.title}'s ${s.label}`} onClick={() => writeOrSay("The tie could not be added.", () => addSuggestedTie(person.id, s))}>
                Add
              </Button>
              <Button size="xs" variant="ghost" aria-label={`Dismiss ${s.otherName} as ${person.title}'s ${s.label}`} onClick={() => void dismiss(s)}>
                Dismiss
              </Button>
            </span>
          </li>
        ))}
      </CardList>
    </div>
  );
}
