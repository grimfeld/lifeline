import { useState } from "react";
import { usePeekDraft, type Document } from "@lifeline/core";
import { Badge, Button, Input, Label, Textarea, toast } from "@lifeline/ui";
import { Plus } from "lucide-react";
import { editStat, useStat, useStatEntries } from "../data/repo";
import { cleanItemList } from "../domain/aggregate";
import type { Stat } from "../domain/types";
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
  const save = (patch: Parameters<typeof editStat>[1]) => editStat(stat.id, patch).catch((e: unknown) => toast.error(`Couldn’t save — ${(e as Error).message}`));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Badge variant="secondary">{KIND_COPY[stat.kind].title}</Badge>
        <span className="text-muted-foreground min-w-0 flex-1 text-xs">{KIND_COPY[stat.kind].hint}</span>
      </div>
      {has.unit && <DraftInput id="stat-peek-unit" label="Unit" value={stat.unit} onCommit={(unit) => save({ unit })} />}
      {has.increment && (
        <DraftInput id="stat-peek-inc" label="Quick-log amount" type="number" value={stat.defaultIncrement ? String(stat.defaultIncrement) : ""} onCommit={(v) => save({ defaultIncrement: Number(v) || 0 })} />
      )}
      {has.items && <ItemsField stat={stat} onCommit={(items) => save({ items })} />}
      {has.items && stat.items.length === 0 && (
        <DraftInput id="stat-peek-universe" label="Out of" type="number" value={stat.universeSize ? String(stat.universeSize) : ""} onCommit={(v) => save({ universeSize: Number(v) || 0 })} />
      )}
      <div className="grid gap-2">
        <Label>Colour</Label>
        <ColorSwatches value={stat.color} onChange={(color) => void save({ color })} />
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

function DraftInput({ id, label, value, type, onCommit }: { id: string; label: string; value: string; type?: string; onCommit: (v: string) => unknown }) {
  const draft = usePeekDraft(value, onCommit);
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={draft.value} onChange={(e) => draft.onChange(e.target.value)} onBlur={draft.flush} onKeyDown={(e) => e.key === "Enter" && draft.flush()} />
    </div>
  );
}

function ItemsField({ stat, onCommit }: { stat: Stat; onCommit: (items: string[]) => unknown }) {
  const draft = usePeekDraft(stat.items.join("\n"), (text) => onCommit(cleanItemList(text.split("\n"))));
  return (
    <div className="grid gap-2">
      <Label htmlFor="stat-peek-items">Items</Label>
      <Textarea id="stat-peek-items" rows={4} className="max-h-48" value={draft.value} onChange={(e) => draft.onChange(e.target.value)} onBlur={draft.flush} />
      <p className="text-muted-foreground text-xs">One per line; the list's length is the total.</p>
    </div>
  );
}
