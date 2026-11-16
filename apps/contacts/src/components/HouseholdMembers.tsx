import { useMemo, useState } from "react";
import { Link } from "react-router";
import { errorMessage, normalizeTag, todayStr, useTagVocabulary, type PeekProps } from "@lifeline/core";
import { Button, Combobox, DatePicker, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, TagInput, Tip } from "@lifeline/ui";
import { CalendarDays, Search, User, X } from "lucide-react";
import { personHref } from "../constants";
import { type Household } from "../domain/types";
import { memberCandidates, membersOf, membershipSpan, splitMembers, type MemberRow } from "../domain/households";
import { asName } from "../domain/person";
import { usePeople } from "../data/repo";
import { addMember, normalizeHousehold, patchHousehold, removeMember, restoreMember, setMembershipDays } from "../data/households";
import { AddRow, CardList } from "./Cards";
import { Section } from "./Section";
import { removeWithUndo } from "./writes";

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
      setError(errorMessage(e));
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

/** Change one member's since and until days: either may stay empty, and until cannot come before since. */
function MemberDaysDialog({ household, member, onOpenChange }: { household: Household; member: MemberRow; onOpenChange: (open: boolean) => void }) {
  const [since, setSince] = useState(member.since ?? "");
  const [until, setUntil] = useState(member.until ?? "");
  const [error, setError] = useState("");
  async function save() {
    try {
      await setMembershipDays(household.id, member.personId, { since, until });
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dates for {member.name}</DialogTitle>
          <DialogDescription>When they lived in {household.title}. Leave a day empty for no limit; someone who moved out stays listed as a former member.</DialogDescription>
        </DialogHeader>
        <Field label="Since" hint="Their first day there.">
          <DatePicker value={since} onChange={(d) => { setSince(d); setError(""); }} max={until || undefined} startYear={1900} aria-label="Since" />
        </Field>
        <Field label="Until" hint="Their last day there." error={error || undefined}>
          <DatePicker value={until} onChange={(d) => { setUntil(d); setError(""); }} min={since || undefined} startYear={1900} aria-label="Until" />
        </Field>
        <DialogFooter>
          <Button onClick={() => void save()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberItem({ household, member, onDays }: { household: Household; member: MemberRow; onDays: () => void }) {
  const span = membershipSpan(member);
  return (
    <li className="flex min-w-0 items-center gap-3 px-3 py-2" data-testid="member">
      <User className="text-muted-foreground size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <Link to={personHref(member.personId)} className="block text-sm break-words underline-offset-2 hover:underline">
          {member.name}
        </Link>
        {span && <p className="text-muted-foreground text-xs break-words">{span}</p>}
      </div>
      <Tip label={`Dates for ${member.name} in ${household.title}`}>
        <Button variant="ghost" size="icon-xs" className="shrink-0" onClick={onDays}>
          <CalendarDays />
        </Button>
      </Tip>
      <Tip label={`Remove ${member.name} from ${household.title}`}>
        <Button
          variant="ghost"
          size="icon-xs"
          className="shrink-0"
          onClick={() => void removeWithUndo(`${member.name} from ${household.title}`, () => removeMember(household.id, member.personId), (removed) => restoreMember(household.id, removed))}
        >
          <X />
        </Button>
      </Tip>
    </li>
  );
}

/**
 * A Household's members (ADR 0117), on its page and in its Peek alike: each
 * a link to their page with their since and until days, a button for those
 * days, and a cross that takes them out (with Undo); then an Add row. Those
 * whose until day has passed are listed apart, as former members. Only People
 * of this Workspace are listed and offered.
 */
export function HouseholdMembers({ household }: { household: Household }) {
  const people = usePeople();
  const { current, former } = useMemo(() => splitMembers(membersOf(household, people), todayStr()), [household, people]);
  const [adding, setAdding] = useState(false);
  const [dating, setDating] = useState<string>();
  const datingRow = [...current, ...former].find((m) => m.personId === dating);
  return (
    <>
      <CardList>
        {current.length === 0 && <li className="text-muted-foreground px-3 py-2 text-sm">{former.length ? "No current members." : "No members yet."}</li>}
        {current.map((m) => (
          <MemberItem key={m.personId} household={household} member={m} onDays={() => setDating(m.personId)} />
        ))}
        <AddRow onClick={() => setAdding(true)}>Add member</AddRow>
      </CardList>
      {former.length > 0 && (
        <div className="mt-3 grid gap-1" role="group" aria-label="Former members">
          <h3 className="text-muted-foreground text-sm font-medium">Former members</h3>
          <CardList>
            {former.map((m) => (
              <MemberItem key={m.personId} household={household} member={m} onDays={() => setDating(m.personId)} />
            ))}
          </CardList>
        </div>
      )}
      {adding && <AddMemberDialog household={household} onOpenChange={(o) => !o && setAdding(false)} />}
      {datingRow && <MemberDaysDialog household={household} member={datingRow} onOpenChange={(o) => !o && setDating(undefined)} />}
    </>
  );
}

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
