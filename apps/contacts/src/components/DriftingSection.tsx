import { formatHuman } from "@lifeline/core";
import { Button, Tip, ToggleGroup, ToggleGroupItem } from "@lifeline/ui";
import { DRIFTING_DAYS, driftLine, type Drifter, type DriftSource } from "../domain/drifting";
import { patchPerson } from "../data/repo";
import { PersonRowLink, RelationshipLabel } from "./PersonRow";
import { writeOrSay } from "./writes";
import { Section } from "./Section";

/** What each switch position counts, in words. */
const WORD: Record<DriftSource, string> = { inTouch: "in touch", mentioned: "mentioned" };

/**
 * Drifting on the People home (#404 story 70, ADR 0131): who I have lost touch
 * with — the never in touch first, then the longest out of touch, each row
 * saying how they last were ("call · 120 days ago"). Not in touch in 90 days
 * (seen or talked, the later), or switched to Not mentioned. Derived and never a reminder; "Leave out" drops
 * someone from it, and their page brings them back. The People home works
 * the rows out and holds the switch, so Everyone's badges follow it.
 */
export function DriftingSection({ rows, source, onSourceChange }: { rows: readonly Drifter[]; source: DriftSource; onSourceChange: (source: DriftSource) => void }) {
  const toggle = (
    <ToggleGroup value={source} onValueChange={(v) => onSourceChange(v as DriftSource)} aria-label="Drifting by">
      <ToggleGroupItem value="inTouch" aria-label="Not in touch">
        Not in touch
      </ToggleGroupItem>
      <ToggleGroupItem value="mentioned" aria-label="Not mentioned">
        Not mentioned
      </ToggleGroupItem>
    </ToggleGroup>
  );

  return (
    <Section title="Drifting" actions={toggle}>
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">No one with a Relationship has gone {DRIFTING_DAYS} days without being {WORD[source]}.</p>
      ) : (
        <ul className="grid min-w-0 gap-2">
          {rows.map((row) => (
            <li key={row.person.id} className="flex min-w-0 items-center gap-2">
              <PersonRowLink personId={row.person.id} className="flex-1">
                <span className="min-w-0 flex-1 truncate font-medium">{row.person.title}</span>
                <RelationshipLabel>{row.person.relationship}</RelationshipLabel>
                {row.last === null ? (
                  <span className="text-muted-foreground shrink-0 text-xs">{driftLine(row, source)}</span>
                ) : (
                  <Tip label={`Last ${WORD[source]} ${formatHuman(row.last)}`}>
                    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{driftLine(row, source)}</span>
                  </Tip>
                )}
              </PersonRowLink>
              <Button variant="ghost" size="sm" className="shrink-0" aria-label={`Leave out ${row.person.title}`} onClick={() => writeOrSay(`${row.person.title} could not be left out.`, () => patchPerson(row.person.id, { excludedFromDrifting: true }))}>
                Leave out
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
