import { useMemo, useState } from "react";
import { PERSON_TYPE, singularOf, todayStr, useAllDocuments, useDocumentTypes, useDocuments } from "@lifeline/core";
import { Button, Combobox, type ComboboxOption } from "@lifeline/ui";
import { Search, X } from "lucide-react";
import { afterKey, groupOptions, personOptions, withMembers, withPerson, type GroupChoice } from "./peopleChoice";

/**
 * A People field (CONTEXT.md): the chosen People as removable chips, and a
 * type-ahead that completes their names and aliases (the way Library's Author
 * box does). It writes a list of Person ids, for a `links` Field restricted
 * to the Person type: an Event's With, a Task's For… It reaches People through
 * Core's type, so the App using it never imports Contacts.
 *
 * With `groups` (an Event's With, ADR 0117) it also offers the Documents that
 * stand for People (a Household, through the Linkable `members` hook): picking
 * one adds its members of today as People, each removable. It never holds the
 * group itself.
 */
export function PeopleField(props: PeopleFieldProps) {
  return props.groups ? <WithGroups {...props} /> : <PeopleFieldView {...props} offered={NO_GROUPS} />;
}

interface PeopleFieldProps {
  value: string[];
  onChange: (ids: string[]) => void;
  id?: string;
  /** What the suggestion list is called to a screen reader. */
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** Also offer Households (any Linkable type that declares `members`): opt-in, for an Event's With only. */
  groups?: boolean;
}

const NO_GROUPS: GroupChoice[] = [];

/** The field, given the groups it offers: their Documents with their members today. */
function WithGroups(props: PeopleFieldProps) {
  const types = useDocumentTypes();
  const all = useAllDocuments();
  const groups = useMemo(() => {
    const day = todayStr();
    const byType = new Map(types.flatMap((t) => (typeof t.linkable === "object" && t.linkable.members ? [[t.id, { def: t, members: t.linkable.members }] as const] : [])));
    if (!byType.size) return NO_GROUPS;
    return all.flatMap((doc): GroupChoice[] => {
      const g = byType.get(doc.type);
      return g ? [{ doc, kind: singularOf(g.def), members: g.members(doc, day) }] : [];
    });
  }, [types, all]);
  return <PeopleFieldView placeholder="Add a person or household…" {...props} offered={groups} />;
}

function PeopleFieldView({ value, onChange, id, label = "People", placeholder = "Add a person…", autoFocus, offered: groups }: Omit<PeopleFieldProps, "groups"> & { offered: readonly GroupChoice[] }) {
  const people = useDocuments(PERSON_TYPE);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const [query, setQuery] = useState("");
  const groupById = useMemo(() => new Map(groups.map((g) => [g.doc.id, g])), [groups]);
  const options = useMemo<ComboboxOption[]>(() => [...personOptions(people, value), ...groupOptions(groups, people, value)], [people, groups, value]);
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
          const group = groupById.get(pid);
          const next = group ? withMembers(value, group.members, people) : withPerson(value, pid);
          if (next) onChange(next);
        }}
        limit={6}
        listLabel={label}
        leading={<Search />}
        placeholder={placeholder}
        autoFocus={autoFocus}
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
