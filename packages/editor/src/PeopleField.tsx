import { useMemo, useState } from "react";
import { PERSON_TYPE, useDocuments } from "@lifeline/core";
import { Button, Combobox } from "@lifeline/ui";
import { Search, X } from "lucide-react";
import { afterKey, personOptions, withPerson } from "./peopleChoice";

/**
 * A People field (CONTEXT.md): the chosen People as removable chips, and a
 * type-ahead that completes their names and aliases (the way Library's Author
 * box does). It writes a list of Person ids, for a `links` Field restricted
 * to the Person type: an Event's With, a Task's For… It reaches People through
 * Core's type, so the App using it never imports Contacts.
 */
export function PeopleField({
  value,
  onChange,
  id,
  label = "People",
  placeholder = "Add a person…",
  autoFocus,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  id?: string;
  /** What the suggestion list is called to a screen reader. */
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const people = useDocuments(PERSON_TYPE);
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const [query, setQuery] = useState("");
  const options = useMemo(() => personOptions(people, value), [people, value]);
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
          const next = withPerson(value, pid);
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
