import { useState } from "react";
import type { Document } from "@lifeline/core";
import { Badge, Button, CommitField, Label, toast } from "@lifeline/ui";
import { Plus } from "lucide-react";
import { editStat, useStat, useStatEntries } from "../data/repo";
import { cleanItemList } from "../domain/aggregate";
import { AddEntryDialog } from "./AddEntryDialog";
import { ColorSwatches, KIND_COPY, kindHas } from "./StatFields";

/**
 * A Stat's editable Peek (ADR 0085): its unit, quick-log amount, items and
 * colour edited in place through the editor's own operation (`editStat`),
 * and an entry logged without leaving. The Kind is shown, never edited: it is
 * fixed once entries mean something.
 */
export function StatPeek({ doc }: { doc: Document }) {
  const stat = useStat(doc.id);
  const entries = useStatEntries(doc.id);
  const [logging, setLogging] = useState(false);
  if (!stat) return null;
  const has = kindHas(stat.kind);
  const save = (patch: Parameters<typeof editStat>[1]) => editStat(stat.id, patch);
  const count = (n: number) => (n ? String(n) : "");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="secondary">{KIND_COPY[stat.kind].title}</Badge>
        <span className="text-muted-foreground min-w-0 flex-1 text-xs">{KIND_COPY[stat.kind].hint}</span>
      </div>
      {has.unit && <CommitField label="Unit" value={stat.unit} onCommit={(unit) => save({ unit })} />}
      {has.increment && (
        <CommitField label="Quick-log amount" type="number" value={count(stat.defaultIncrement)} onCommit={(v) => save({ defaultIncrement: Number(v) || 0 })} />
      )}
      {has.items && (
        <CommitField
          label="Items"
          multiline
          rows={4}
          className="[&_textarea]:max-h-48"
          hint="One per line; the list's length is the total."
          value={stat.items.join("\n")}
          onCommit={(text) => save({ items: cleanItemList(text.split("\n")) })}
        />
      )}
      {has.items && stat.items.length === 0 && (
        <CommitField label="Out of" type="number" value={count(stat.universeSize)} onCommit={(v) => save({ universeSize: Number(v) || 0 })} />
      )}
      <div className="grid gap-2">
        <Label>Colour</Label>
        <ColorSwatches
          value={stat.color}
          onChange={(color) => void save({ color }).catch((e: unknown) => toast.error("Couldn’t change the colour", { description: e instanceof Error ? e.message : String(e) }))}
        />
      </div>
      <div>
        <Button size="sm" variant="outline" onClick={() => setLogging(true)}>
          <Plus />
          {stat.kind === "boolean" ? "Mark a day…" : "Log…"}
        </Button>
      </div>
      <AddEntryDialog open={logging} onOpenChange={setLogging} stat={stat} entries={entries} />
    </div>
  );
}
