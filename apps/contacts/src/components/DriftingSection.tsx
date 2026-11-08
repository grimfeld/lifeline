import { useMemo, useState } from "react";
import { Link } from "react-router";
import { todayStr, useLinkIndex } from "@lifeline/core";
import { Button, ToggleGroup, ToggleGroupItem } from "@lifeline/ui";
import { personHref } from "../constants";
import { DRIFTING_DAYS, drifting, type DriftSource } from "../domain/drifting";
import type { Person } from "../domain/types";
import { patchPerson } from "../data/repo";

/**
 * Drifting on the People home (#404 story 70): who I have lost touch with,
 * longest unseen first. Not seen in 90 days, or switched to Not mentioned.
 * Derived and never a reminder; "Leave out" drops someone from it, and their
 * page brings them back.
 */
export function DriftingSection({ people }: { people: readonly Person[] }) {
  const [source, setSource] = useState<DriftSource>("seen");
  const index = useLinkIndex();
  const today = todayStr();
  const rows = useMemo(() => drifting(index, people, { source, today }), [index, people, source, today]);
  const what = source === "seen" ? "seen" : "mentioned";

  return (
    <section className="grid min-w-0 gap-2" aria-label="Drifting">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-sm font-medium">Drifting</h2>
        <ToggleGroup value={source} onValueChange={(v) => setSource(v as DriftSource)} aria-label="Drifting by">
          <ToggleGroupItem value="seen" aria-label="Not seen">
            Not seen
          </ToggleGroupItem>
          <ToggleGroupItem value="mentioned" aria-label="Not mentioned">
            Not mentioned
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No one with a Relationship has gone {DRIFTING_DAYS} days without being {what}.</p>
      ) : (
        <ul className="grid min-w-0 gap-2">
          {rows.map(({ person, last, daysSince }) => (
            <li key={person.id} className="flex min-w-0 items-center gap-2 rounded-lg border p-3">
              <Link to={personHref(person.id)} className="focus-visible:ring-ring flex min-w-0 flex-1 items-baseline justify-between gap-3 rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none">
                <span className="min-w-0 flex-1 truncate font-medium">{person.title}</span>
                <span className="text-muted-foreground min-w-0 max-w-[40%] shrink truncate text-sm">{person.relationship}</span>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums" title={`Last ${what} ${last}`}>
                  {daysSince} days
                </span>
              </Link>
              <Button variant="ghost" size="sm" className="shrink-0" aria-label={`Leave ${person.title} out of Drifting`} onClick={() => void patchPerson(person.id, { excludedFromDrifting: true })}>
                Leave out
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
