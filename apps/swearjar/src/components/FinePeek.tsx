import { closePeek, type Document } from "@lifeline/core";
import { Button, CommitField, toast } from "@lifeline/ui";
import { deleteFine, editFine, useOffences } from "../data/repo";
import { faceColor, faceOf, type Fine } from "../domain/types";
import { formatCents } from "../domain/money";
import { localInputOf, nowLocalInput } from "./FineDialog";

/**
 * A Fine's editable Peek (ADR 0085): when it happened and its note, edited in
 * place through `editFine`; the Offence and the amount it cost then are shown,
 * never edited — they are the Fine's facts (guarded). Delete is there for the
 * mis-tap, as in the Fine's dialog.
 */
export function FinePeek({ doc }: { doc: Document }) {
  const fine = doc as Fine;
  const offence = useOffences().find((o) => o.id === fine.offenceId);

  function setWhen(next: string) {
    const moment = new Date(next);
    if (!next || Number.isNaN(moment.getTime())) throw new Error("Pick when it happened");
    return editFine(fine.id, { occurredAt: moment.toISOString() });
  }

  async function remove() {
    try {
      await deleteFine(fine.id);
    } catch (e) {
      toast.error("Couldn’t delete the Fine", { description: e instanceof Error ? e.message : String(e) });
      return;
    }
    closePeek();
    toast.success("Fine deleted");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full text-xl leading-none text-white" style={{ background: offence ? faceColor(offence) : undefined }}>
          {offence ? faceOf(offence) : "?"}
        </span>
        <span className="min-w-0 flex-1 break-words text-sm">{offence?.name ?? "A deleted offence"}</span>
        <span className="shrink-0 text-lg font-semibold tabular-nums">{formatCents(Number(fine.amount) || 0)}</span>
      </div>
      <CommitField label="When it happened" type="datetime-local" required max={nowLocalInput()} value={fine.occurredAt ? localInputOf(fine.occurredAt) : ""} onCommit={setWhen} />
      <CommitField label="Note" multiline rows={2} value={fine.note ?? ""} onCommit={(note) => editFine(fine.id, { note })} />
      <div>
        <Button size="sm" variant="ghost" onClick={() => void remove()}>
          Delete
        </Button>
      </div>
    </div>
  );
}
