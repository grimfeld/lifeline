import { useMemo, useState } from "react";
import { todayStr } from "@lifeline/core";
import { Link, useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState, Field, Input, Page, PageHeader, PhoneDock } from "@lifeline/ui";
import { ArrowLeft, Home, Plus } from "lucide-react";
import { PEOPLE_HREF, householdHref } from "../constants";
import { byName, currentMemberNames } from "../domain/households";
import { usePeople } from "../data/repo";
import { addHousehold, useHouseholds } from "../data/households";
import { message } from "../components/writes";

/** Add a Household from its name; its page opens, to choose its members. */
function AddHouseholdDialog({ onOpenChange }: { onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  async function save() {
    try {
      const h = await addHousehold({ name });
      onOpenChange(false);
      navigate(householdHref(h.id));
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a household</DialogTitle>
          <DialogDescription>The People who live together, by the name you call them. You choose its members on its page.</DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <Field label="Name" error={error || undefined}>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              placeholder="the Smiths"
              autoFocus
              autoComplete="off"
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The People Module's Households screen (ADR 0117): every Household in the
 * Workspace, A to Z, each with its current members' names (not the former
 * ones its page lists apart); a link to its page.
 */
export function HouseholdsScreen() {
  const households = useHouseholds();
  const people = usePeople();
  const [adding, setAdding] = useState(false);
  const rows = useMemo(
    () => [...households].sort((a, b) => byName(a.title, b.title)).map((h) => ({ household: h, names: currentMemberNames(h, people, todayStr()) })),
    [households, people],
  );
  const addButton = (
    <Button onClick={() => setAdding(true)}>
      <Plus /> Add household
    </Button>
  );
  return (
    <Page>
      <Link to={PEOPLE_HREF} className="text-muted-foreground inline-flex items-center gap-1 text-sm hover:underline">
        <ArrowLeft className="size-4" /> People
      </Link>
      <PageHeader title="Households">{rows.length > 0 ? <PhoneDock>{addButton}</PhoneDock> : null}</PageHeader>
      {rows.length === 0 ? (
        <EmptyState action={addButton}>The People who live together. Add one, choose its members, then link it from any page with [[its name]].</EmptyState>
      ) : (
        <ul className="grid min-w-0">
          {rows.map(({ household, names }) => (
            <li key={household.id}>
              <Link
                to={householdHref(household.id)}
                className="hover:bg-accent focus-visible:ring-ring flex min-w-0 items-center gap-3 rounded-lg px-2 py-2 focus-visible:ring-2 focus-visible:outline-none"
              >
                <Home className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <span className="grid min-w-0 flex-1">
                  <span className="min-w-0 truncate font-medium">{household.title}</span>
                  <span className="text-muted-foreground min-w-0 truncate text-xs">{names.length ? names.join(", ") : "No members yet"}</span>
                </span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums" aria-hidden>
                  {names.length}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {adding && <AddHouseholdDialog onOpenChange={(o) => !o && setAdding(false)} />}
    </Page>
  );
}
