import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea } from "@lifeline/ui";
import { describeBlock, formatClock } from "../domain/intervals";
import { MODE_LABEL, type BlockResult, type Exercise, type MovementResult, type Workout } from "../domain/types";

function num(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

/**
 * The Session summary right after the timer (ADR 0030): each Block's result
 * in its mode's terms, and what each Movement actually got — prefilled from
 * the plan, so most of the time it is one tap.
 */
export function SessionResultsDialog({
  open,
  workout,
  exercises,
  initial,
  initialNotes = "",
  saving = false,
  onSave,
  onDiscard,
}: {
  open: boolean;
  workout: Workout;
  exercises: Exercise[];
  initial: BlockResult[];
  /** A saved Session's notes, when its results are edited again (its Peek). */
  initialNotes?: string;
  /** A save is in flight: the buttons wait for it. */
  saving?: boolean;
  onSave: (results: BlockResult[], notes: string) => void;
  onDiscard: () => void;
}) {
  const [results, setResults] = useState<BlockResult[]>(initial);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    if (open) {
      setResults(initial);
      setNotes(initialNotes);
    }
  }, [open, initial, initialNotes]);

  const exById = new Map(exercises.map((e) => [e.id, e]));
  const setResult = (i: number, r: BlockResult) => setResults((cur) => cur.map((x, j) => (j === i ? r : x)));
  const setMovement = (bi: number, mi: number, m: MovementResult) => setResult(bi, { ...results[bi], movements: results[bi].movements.map((x, j) => (j === mi ? m : x)) });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onDiscard()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>How did it go?</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          {results.map((r, bi) => {
            const block = workout.blocks.find((b) => b.id === r.blockId);
            return (
              <div key={r.blockId} className="grid gap-2 rounded-lg border p-3">
                <div className="text-sm font-medium">
                  {block?.label || MODE_LABEL[r.mode]} <span className="text-muted-foreground font-normal">{block ? describeBlock(block) : ""}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {r.mode === "amrap" && (
                    <>
                      <label className="flex items-center gap-1">
                        <Input type="number" min={0} className="h-8 w-16 tabular-nums" value={r.rounds ?? ""} onChange={(e) => setResult(bi, { ...r, rounds: num(e.target.value) })} /> rounds
                      </label>
                      <label className="flex items-center gap-1">
                        + <Input type="number" min={0} className="h-8 w-16 tabular-nums" value={r.extraReps ?? ""} onChange={(e) => setResult(bi, { ...r, extraReps: num(e.target.value) })} /> reps
                      </label>
                    </>
                  )}
                  {r.mode === "fortime" && (
                    <label className="flex items-center gap-1">
                      Time <Input className="h-8 w-20 tabular-nums" value={r.seconds === null ? "" : formatClock(r.seconds)} onChange={(e) => setResult(bi, { ...r, seconds: parseClock(e.target.value) })} placeholder="cap" />
                    </label>
                  )}
                  {(r.mode === "emom" || r.mode === "tabata" || r.mode === "intervals") && (
                    <label className="flex items-center gap-1">
                      <Input type="number" min={0} className="h-8 w-16 tabular-nums" value={r.rounds ?? ""} onChange={(e) => setResult(bi, { ...r, rounds: num(e.target.value) })} /> of {block?.rounds ?? "?"} rounds
                    </label>
                  )}
                </div>
                {r.movements.length > 0 && (
                  <div className="grid gap-1">
                    {r.movements.map((m, mi) => {
                      const ex = exById.get(m.exerciseId);
                      const measure = ex?.measure ?? "reps";
                      const field = (key: keyof MovementResult, label: string, step = 1) => (
                        <label className="flex items-center gap-1 text-xs">
                          <Input type="number" min={0} step={step} className="h-8 w-20 tabular-nums" value={m[key] === null ? "" : String(m[key])} onChange={(e) => setMovement(bi, mi, { ...m, [key]: num(e.target.value) })} />
                          <span className="text-muted-foreground">{label}</span>
                        </label>
                      );
                      return (
                        <div key={mi} className="flex flex-wrap items-center gap-2">
                          <span className="w-36 truncate text-sm">{ex?.title ?? "?"}</span>
                          {(measure === "reps" || measure === "load") && field("reps", "reps")}
                          {measure === "load" && field("load", "kg", 2.5)}
                          {measure === "time" && field("seconds", "s", 5)}
                          {measure === "distance" && field("distance", "m", 50)}
                          {measure === "calories" && field("calories", "cal")}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div className="grid gap-2">
            <Label htmlFor="ses-notes">Notes</Label>
            <Textarea id="ses-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How it felt, what to change" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onDiscard}>
            Discard
          </Button>
          <Button disabled={saving} onClick={() => onSave(results, notes)}>
            {saving ? "Saving…" : "Save session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "12:34" → 754; "90" → 90. */
function parseClock(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const parts = t.split(":").map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return parts.length === 1 ? parts[0] : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] * 3600 + parts[1] * 60 + parts[2];
}
