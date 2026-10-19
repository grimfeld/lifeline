import { useState } from "react";
import { formatHuman, usePeekDraft, type Document } from "@lifeline/core";
import { Button, Label, Textarea, toast } from "@lifeline/ui";
import { Pencil } from "lucide-react";
import { normalizeSession, updateSessionNotes, useExercises, useWorkout } from "../data/repo";
import { resultsSummary } from "../domain/intervals";
import type { BlockResult, Session } from "../domain/types";
import { SessionResultsDialog } from "./SessionResultsDialog";

/**
 * A Workout session's editable Peek (ADR 0085): what happened, its notes
 * written in place, and its results edited again in the timer's own summary
 * form. The clock, the Workout it ran and the results are the timer's facts
 * (guarded): only `updateSessionNotes` changes them, never a raw field.
 */
export function SessionPeek({ doc }: { doc: Document }) {
  const s = normalizeSession(doc as Session);
  const workout = useWorkout(s.workoutId);
  const exercises = useExercises();
  const [editing, setEditing] = useState(false);
  const fail = (e: unknown) => toast.error(`Couldn’t save — ${(e as Error).message}`);
  const notes = usePeekDraft(s.notes, (next) => updateSessionNotes(s.id, next.trim()).catch(fail));
  const summary = resultsSummary(s, workout);

  async function saveResults(results: BlockResult[], next: string) {
    try {
      await updateSessionNotes(s.id, next.trim(), results);
      setEditing(false);
    } catch (e) {
      fail(e);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Workout</dt>
        <dd className="min-w-0 break-words">{workout?.title ?? "A deleted workout"}</dd>
        <dt className="text-muted-foreground">When</dt>
        <dd className="min-w-0 break-words tabular-nums">
          {s.date ? formatHuman(s.date) : "—"} · {s.start}–{s.end} · {s.durationMin} min
        </dd>
        {summary && (
          <>
            <dt className="text-muted-foreground">Results</dt>
            <dd className="min-w-0 break-words">{summary}</dd>
          </>
        )}
      </dl>
      <div className="grid gap-2">
        <Label htmlFor="session-peek-notes">Notes</Label>
        <Textarea id="session-peek-notes" rows={3} value={notes.value} placeholder="How it felt, what to change" onChange={(e) => notes.onChange(e.target.value)} onBlur={notes.flush} />
      </div>
      {workout && s.results.length > 0 && (
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              notes.flush();
              setEditing(true);
            }}
          >
            <Pencil />
            Edit results…
          </Button>
        </div>
      )}
      {workout && editing && (
        <SessionResultsDialog open workout={workout} exercises={exercises} initial={s.results} initialNotes={notes.value} onSave={(r, n) => void saveResults(r, n)} onDiscard={() => setEditing(false)} />
      )}
    </div>
  );
}
