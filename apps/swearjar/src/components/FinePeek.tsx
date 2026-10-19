import { closePeek, usePeekDraft, type Document } from "@lifeline/core";
import { Button, Input, Label, Textarea, toast } from "@lifeline/ui";
import { deleteFine, editFine, useOffences } from "../data/repo";
import { faceColor, faceOf, type Fine } from "../domain/types";
import { formatCents } from "../domain/money";
import { localInputOf, nowLocalInput } from "./FineDialog";

const fail = (e: unknown) => toast.error(`Couldn’t save — ${(e as Error).message}`);

/**
 * A Fine's editable Peek (ADR 0085): when it happened and its note, edited in
 * place through `editFine`; the Offence and the amount it cost then are shown,
 * never edited — they are the Fine's facts (guarded). Delete is there for the
 * mis-tap, as in the Fine's dialog.
 */
export function FinePeek({ doc }: { doc: Document }) {
  const fine = doc as Fine;
  const offence = useOffences().find((o) => o.id === fine.offenceId);
  const when = usePeekDraft(fine.occurredAt ? localInputOf(fine.occurredAt) : "", (next) => {
    const moment = new Date(next);
    if (!next || Number.isNaN(moment.getTime())) return toast.error("Pick when it happened");
    return editFine(fine.id, { occurredAt: moment.toISOString() }).catch(fail);
  });
  const note = usePeekDraft(fine.note ?? "", (next) => editFine(fine.id, { note: next }).catch(fail));

  async function remove() {
    await deleteFine(fine.id);
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
      <div className="grid gap-2">
        <Label htmlFor="fine-peek-when">When it happened</Label>
        <Input id="fine-peek-when" type="datetime-local" max={nowLocalInput()} value={when.value} onChange={(e) => when.onChange(e.target.value)} onBlur={when.flush} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="fine-peek-note">Note</Label>
        <Textarea id="fine-peek-note" rows={2} value={note.value} onChange={(e) => note.onChange(e.target.value)} onBlur={note.flush} />
      </div>
      <div>
        <Button size="sm" variant="ghost" onClick={() => void remove().catch(fail)}>
          Delete
        </Button>
      </div>
    </div>
  );
}
