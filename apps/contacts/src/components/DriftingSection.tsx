import { useMemo, useState } from "react";
import { formatHuman, todayStr, useLinkIndex } from "@lifeline/core";
import { Button, Tip, ToggleGroup, ToggleGroupItem } from "@lifeline/ui";
import { DRIFTING_DAYS, drifting, type DriftSource } from "../domain/drifting";
import type { Person } from "../domain/types";
import { patchPerson } from "../data/repo";
import { PersonRowLink, RelationshipLabel } from "./PersonRow";
import { writeOrSay } from "./writes";
import { Section } from "./Section";

/**
 * Drifting on the People home (#404 story 70): who I have lost touch with —
 * the never seen first, then the longest unseen. Not seen in 90 days, or
 * switched to Not mentioned. Derived and never a reminder; "Leave out" drops
 * someone from it, and their page brings them back.
 */
export function DriftingSection({ people }: { people: readonly Person[] }) {
  const [source, setSource] = useState<DriftSource>("seen");
  const index = useLinkIndex();
  const today = todayStr();
  const rows = useMemo(() => drifting(index, people, { source, today }), [index, people, source, today]);

  const toggle = (
    <ToggleGroup value={source} onValueChange={(v) => setSource(v as DriftSource)} aria-label="Drifting by">
      <ToggleGroupItem value="seen" aria-label="Not seen">
        Not seen
      </ToggleGroupItem>
      <ToggleGroupItem value="mentioned" aria-label="Not mentioned">
        Not mentioned
      </ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <Section title="Drifting" actions={toggle}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No one with a Relationship has gone {DRIFTING_DAYS} days without being {source}.</p>
      ) : (
        <ul className="grid min-w-0 gap-2">
          {rows.map(({ person, last, daysSince }) => (
            <li key={person.id} className="flex min-w-0 items-center gap-2">
              <PersonRowLink personId={person.id} className="flex-1">
                <span className="min-w-0 flex-1 truncate font-medium">{person.title}</span>
                <RelationshipLabel>{person.relationship}</RelationshipLabel>
                {last === null ? (
                  <span className="text-muted-foreground shrink-0 text-xs">Never {source}</span>
                ) : (
                  <Tip label={`Last ${source} ${formatHuman(last)}`}>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{daysSince} days</span>
                  </Tip>
                )}
              </PersonRowLink>
              <Button variant="ghost" size="sm" className="shrink-0" aria-label={`Leave out ${person.title}`} onClick={() => writeOrSay(`${person.title} could not be left out.`, () => patchPerson(person.id, { excludedFromDrifting: true }))}>
                Leave out
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
