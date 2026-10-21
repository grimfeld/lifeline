import { useEffect, useMemo, useState } from "react";
import { Button, DateTimeField, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, nowMoment, toast } from "@lifeline/ui";
import { initialMoment, initialText } from "@lifeline/core";
import { faceOf, type Fine } from "../domain/types";
import { activeOffences } from "../domain/derive";
import { formatCents } from "../domain/money";
import { deleteFine, logFine, updateFine, useOffences } from "../data/repo";

/** An ISO instant as a `datetime-local` value, in local time. */
export function localInputOf(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Log a Fine with the details (ADR 0083): which Offence, when it really
 * happened (backdating allowed, into a past month too), an optional note.
 * The amount is never typed — it is the Offence's price. In edit mode only
 * the moment and the note move; Delete is there for the mis-tap.
 */
export function FineDialog({ open, onOpenChange, fine, offenceId, initial }: { open: boolean; onOpenChange: (open: boolean) => void; /** Present = edit mode. */ fine?: Fine; /** Preselect (a long-press on its button). */ offenceId?: string; /** The palette's inline line (CommandDialogProps.initial). */ initial?: Record<string, unknown> }) {
  const offences = useOffences();
  const active = useMemo(() => activeOffences(offences), [offences]);
  const [pick, setPick] = useState("");
  const [when, setWhen] = useState(nowMoment());
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) return;
    // The line names the Offence by id or exact name.
    const named = initialText(initial, "offence").trim().toLowerCase();
    const fromLine = named ? active.find((o) => o.id === initialText(initial, "offence") || o.name.trim().toLowerCase() === named)?.id : undefined;
    setPick(fine?.offenceId ?? fromLine ?? offenceId ?? active[0]?.id ?? "");
    setWhen(fine ? localInputOf(fine.occurredAt) : (initialMoment(initial) ?? nowMoment()));
    setNote(fine?.note ?? initialText(initial, "note"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fine, offenceId, initial, active.length === 0]);

  const picked = offences.find((o) => o.id === pick);

  async function save() {
    // An empty moment is "": an Invalid Date, which toISOString throws on.
    const moment = new Date(when);
    if (!when || Number.isNaN(moment.getTime())) return void toast.error("Pick when it happened");
    const occurredAt = moment.toISOString();
    try {
      if (fine) {
        await updateFine(fine, picked, { occurredAt, note });
        toast.success("Fine updated");
      } else {
        if (!picked) return void toast.error("Pick an offence");
        await logFine(picked, { occurredAt, note });
        toast.success(`${formatCents(picked.price)} in the jar · ${picked.name}`);
      }
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    onOpenChange(false);
  }

  async function remove() {
    if (!fine) return;
    await deleteFine(fine.id);
    toast.success("Fine deleted");
    onOpenChange(false);
  }

  const noneToLog = !fine && active.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{fine ? "Edit fine" : "Log a fine"}</DialogTitle>
        </DialogHeader>
        {noneToLog ? (
          <p className="text-muted-foreground text-sm">No offences yet — make one in the Swear Jar first.</p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Offence</Label>
              {fine ? (
                <p className="text-sm">
                  {picked ? `${faceOf(picked)} ${picked.name}` : "A deleted offence"} · <span className="tabular-nums">{formatCents(fine.amount)}</span>
                </p>
              ) : (
                <Select value={pick} onValueChange={setPick}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick an offence" />
                  </SelectTrigger>
                  <SelectContent>
                    {active.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {faceOf(o)} {o.name} — {formatCents(o.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fn-when">When it happened</Label>
              <DateTimeField id="fn-when" required value={when} max={nowMoment()} onChange={setWhen} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="fn-note">Note (optional)</Label>
              <Textarea id="fn-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          {fine ? (
            <Button variant="ghost" onClick={() => void remove()}>
              Delete
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => void save()} disabled={noneToLog || !when}>
            {fine ? "Save" : "Fine me"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
