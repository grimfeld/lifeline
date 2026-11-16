import { useMemo, useState } from "react";
import { errorMessage } from "@lifeline/core";
import { Link } from "react-router";
import { Button, Combobox, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, Field } from "@lifeline/ui";
import { Search } from "lucide-react";
import { householdHref } from "../constants";
import { type Household, type Person } from "../domain/types";
import { hasMember, householdsOf } from "../domain/households";
import { addMember, joinNewHousehold, useHouseholds } from "../data/households";

/** "Add to a household…": an existing Household of this Workspace by name, or a new one made of the name typed. */
function JoinHouseholdDialog({ person, households, onOpenChange }: { person: Person; households: readonly Household[]; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const options = useMemo(
    () => households.filter((h) => !hasMember(h, person.id)).map((h) => ({ value: h.id, label: h.title, keywords: h.aliases })),
    [households, person.id],
  );
  async function join(write: () => Promise<unknown>) {
    try {
      await write();
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to a household</DialogTitle>
          <DialogDescription>Where {person.title} lives, with whom. Someone may belong to several.</DialogDescription>
        </DialogHeader>
        <Field label="Household" error={error || undefined}>
          <Combobox
            query={query}
            onQueryChange={setQuery}
            options={options}
            onValueChange={(id) => void join(() => addMember(id, person.id))}
            onCreate={(name) => void join(() => joinNewHousehold(person.id, name))}
            createLabel={(name) => `New household “${name}”`}
            limit={6}
            listLabel="Households"
            leading={<Search />}
            placeholder="the Smiths…"
            autoFocus
          />
        </Field>
      </DialogContent>
    </Dialog>
  );
}

/** The line on a Person's page naming the Households they belong to (ADR 0117), each a link, and "Add to a household…". */
export function PersonHouseholds({ person }: { person: Person }) {
  const households = useHouseholds();
  const theirs = useMemo(() => householdsOf(person.id, households), [person.id, households]);
  const [joining, setJoining] = useState(false);
  return (
    <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1 text-sm" data-testid="person-households">
      <span className="text-muted-foreground">Households:</span>
      {theirs.map((h, i) => (
        // The comma stays inside the name's box, so a wrapped line never leaves it hanging outside.
        <span key={h.id} className="min-w-0 break-words">
          <Link to={householdHref(h.id)} className="underline-offset-2 hover:underline">
            {h.title}
          </Link>
          {i < theirs.length - 1 && <span className="text-muted-foreground">,</span>}
        </span>
      ))}
      <Button variant="link" size="xs" className="px-0" onClick={() => setJoining(true)}>
        Add to a household…
      </Button>
      {joining && <JoinHouseholdDialog person={person} households={households} onOpenChange={(o) => !o && setJoining(false)} />}
    </div>
  );
}
