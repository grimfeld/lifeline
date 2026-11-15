import { useMemo, useState, type AriaAttributes } from "react";
import { PERSON_TYPE, membersOnDay, singularOf, todayStr, useAllDocuments, useDocumentTypes, useDocuments } from "@lifeline/core";
import { Button, Combobox, type ComboboxOption } from "@lifeline/ui";
import { Search, X } from "lucide-react";
import { afterKey, householdOptions, personOptions, withMembers, withPerson, type HouseholdChoice } from "./peopleChoice";

/**
 * A People field (CONTEXT.md): the chosen People as removable chips, and a
 * type-ahead that completes their names and aliases (the way Library's Author
 * box does). It writes a list of Person ids, for a `links` Field restricted
 * to the Person type: an Event's With, a Task's For… It reaches People through
 * Core's type, so the App using it never imports Contacts.
 *
 * With `households` (an Event's With, ADR 0117) it also offers the Documents that
 * stand for People (a Household, through the Linkable `members` hook): picking
 * one adds its members of today as People, each removable. It never holds the
 * Household itself.
 */
export function PeopleField(props: PeopleFieldProps) {
  return props.households ? <WithHouseholds {...props} /> : <PeopleFieldView {...props} offered={NO_HOUSEHOLDS} />;
}

interface PeopleFieldProps {
  value: string[];
  onChange: (ids: string[]) => void;
  id?: string;
  /** What the suggestion list is called to a screen reader. */
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** A `Field` child: it takes the Field's id, description and invalid state. */
  "aria-describedby"?: string;
  "aria-invalid"?: AriaAttributes["aria-invalid"];
  /** Also offer Households (any Linkable type that declares `members`): opt-in, for an Event's With only. */
  households?: boolean;
}

const NO_HOUSEHOLDS: HouseholdChoice[] = [];

/** The field, given the Households it offers (of the current Workspace, as every read is): with their members today. */
function WithHouseholds(props: PeopleFieldProps) {
  const types = useDocumentTypes();
  const all = useAllDocuments();
  const households = useMemo(() => {
    const day = todayStr();
    const byType = new Map(types.flatMap((t) => (typeof t.linkable === "object" && t.linkable.members ? [[t.id, { def: t, members: t.linkable.members }] as const] : [])));
    if (!byType.size) return NO_HOUSEHOLDS;
    return all.flatMap((doc): HouseholdChoice[] => {
      const h = byType.get(doc.type);
      return h ? [{ doc, kind: singularOf(h.def), members: membersOnDay(h.members(doc), day) }] : [];
    });
  }, [types, all]);
  return <PeopleFieldView placeholder="Add a person or household…" {...props} offered={households} />;
}

function PeopleFieldView({
  value,
  onChange,
  id,
  label = "People",
  placeholder = "Add a person…",
  autoFocus,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  offered: households,
}: Omit<PeopleFieldProps, "households"> & { offered: readonly HouseholdChoice[] }) {
  const people = useDocuments(PERSON_TYPE);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const [query, setQuery] = useState("");
  const householdById = useMemo(() => new Map(households.map((h) => [h.doc.id, h])), [households]);
  const options = useMemo<ComboboxOption[]>(() => [...personOptions(people, value), ...householdOptions(households, people, value)], [people, households, value]);
  const nameOf = (pid: string) => byId.get(pid)?.title;

  return (
    <div className="grid min-w-0 gap-1">
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((pid) => (
            <span key={pid} className="bg-muted inline-flex max-w-full min-w-0 items-center gap-0.5 rounded-md pl-1.5 text-xs">
              <span className="min-w-0 truncate">{nameOf(pid) ?? "…"}</span>
              <Button size="icon-xs" variant="ghost" className="text-muted-foreground" aria-label={`Remove ${nameOf(pid) ?? "person"}`} onClick={() => onChange(value.filter((x) => x !== pid))}>
                <X />
              </Button>
            </span>
          ))}
        </div>
      )}
      <Combobox
        id={id}
        query={query}
        onQueryChange={setQuery}
        options={options}
        onValueChange={(pid) => {
          const household = householdById.get(pid);
          const next = household ? withMembers(value, household.members, people) : withPerson(value, pid);
          if (next) onChange(next);
        }}
        limit={6}
        listLabel={label}
        leading={<Search />}
        placeholder={placeholder}
        autoFocus={autoFocus}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
        onKeyDown={(e) => {
          const next = afterKey(e.key, query, value);
          if (!next) return;
          e.preventDefault();
          onChange(next);
        }}
      />
    </div>
  );
}
