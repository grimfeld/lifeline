import { useMemo, useState } from "react";
import { Link } from "react-router";
import { normalizeTag, useTagVocabulary, type PeekProps } from "@lifeline/core";
import { Button, Combobox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Field, TagInput, Tip } from "@lifeline/ui";
import { Search, User, X } from "lucide-react";
import { personHref } from "../constants";
import { type Household } from "../domain/types";
import { memberCandidates, membersOf } from "../domain/households";
import { usePeople } from "../data/repo";
import { addMember, normalizeHousehold, patchHousehold, removeMember, restoreMember } from "../data/households";
import { AddRow, CardList } from "./Cards";
import { Section } from "./Section";
import { message, removeWithUndo } from "./writes";

/** Pick a Person to join `household`: name completion over the People of this Workspace not in it yet. */
function AddMemberDialog({ household, onOpenChange }: { household: Household; onOpenChange: (open: boolean) => void }) {
  const people = usePeople();
  const options = useMemo(() => memberCandidates(household, people), [household, people]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  async function pick(personId: string) {
    try {
      await addMember(household.id, personId);
      onOpenChange(false);
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a member</DialogTitle>
          <DialogDescription>Someone who lives in {household.title}, from your People.</DialogDescription>
        </DialogHeader>
        <Field label="Person" error={error || undefined}>
          <Combobox query={query} onQueryChange={setQuery} options={options} onValueChange={(id) => void pick(id)} limit={6} listLabel="People" leading={<Search />} placeholder="Name…" autoFocus />
        </Field>
      </DialogContent>
    </Dialog>
  );
}

/**
 * A Household's members (ADR 0117), on its page and in its Peek alike: each
 * a link to their page, with a cross that takes them out (with Undo), and
 * an Add row. Only People of this Workspace are listed and offered.
 */
export function HouseholdMembers({ household }: { household: Household }) {
  const people = usePeople();
  const rows = useMemo(() => membersOf(household, people), [household, people]);
  const [adding, setAdding] = useState(false);
  return (
    <>
      <CardList>
        {rows.length === 0 && <li className="text-muted-foreground px-3 py-2 text-sm">No members yet.</li>}
        {rows.map((m) => (
          <li key={m.personId} className="flex min-w-0 items-center gap-3 px-3 py-2" data-testid="member">
            <User className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <Link to={personHref(m.personId)} className="min-w-0 flex-1 text-sm break-words underline-offset-2 hover:underline">
              {m.name}
            </Link>
            <Tip label={`Remove ${m.name} from ${household.title}`}>
              <Button
                variant="ghost"
                size="icon-xs"
                className="shrink-0"
                onClick={() => void removeWithUndo(`${m.name} from ${household.title}`, () => removeMember(household.id, m.personId), (removed) => restoreMember(household.id, removed))}
              >
                <X />
              </Button>
            </Tip>
          </li>
        ))}
        <AddRow onClick={() => setAdding(true)}>Add member</AddRow>
      </CardList>
      {adding && <AddMemberDialog household={household} onOpenChange={(o) => !o && setAdding(false)} />}
    </>
  );
}

/** An alias is a name, kept as written: not lower-cased and hyphenated as a Tag is. */
const asName = (raw: string) => raw.trim() || null;

/** A Household's aliases: other names that link to it ("Smiths", "Paul and Mary's"). */
export function HouseholdAliases({ household }: { household: Household }) {
  return (
    <Field label="Aliases" hint="Other names it goes by: each one links to it.">
      <TagInput value={household.aliases} onChange={(aliases) => void patchHousehold(household.id, { aliases })} normalize={asName} placeholder="Smiths…" />
    </Field>
  );
}

/** A Household's editable Peek (ADR 0085): its aliases and members; Core frames it with the name, the body and "Open". */
export function HouseholdPeek({ doc }: PeekProps) {
  const household = normalizeHousehold(doc as Household);
  // Tags, as a Person's Peek edits them: the frame leaves Tags to the App's part.
  const suggestions = useTagVocabulary().map((v) => v.tag);
  return (
    <div className="grid min-w-0 gap-3">
      <HouseholdAliases household={household} />
      <Section title="Members">
        <HouseholdMembers household={household} />
      </Section>
      <Field label="Tags">
        <TagInput value={household.tags ?? []} onChange={(tags) => void patchHousehold(household.id, { tags })} suggestions={suggestions} normalize={normalizeTag} placeholder="Add tag…" />
      </Field>
    </div>
  );
}
