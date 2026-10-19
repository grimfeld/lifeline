import { useRef, useState } from "react";
import { formatHuman, type Document } from "@lifeline/core";
import { Button, CommitField, toast } from "@lifeline/ui";
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
  // The notes' last write: leaving the field for "Edit results…" writes them, and the form opens on them once written.
  const writing = useRef<Promise<unknown>>(Promise.resolve());
  const summary = resultsSummary(s, workout);

  async function saveResults(results: BlockResult[], next: string) {
    try {
      await updateSessionNotes(s.id, next.trim(), results);
      setEditing(false);
    } catch (e) {
      toast.error("Couldn’t save the results", { description: e instanceof Error ? e.message : String(e) });
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
      <CommitField label="Notes" multiline rows={3} value={s.notes} placeholder="How it felt, what to change" onCommit={(next) => (writing.current = updateSessionNotes(s.id, next.trim()))} />
      {workout && s.results.length > 0 && (
        <div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void writing.current.then(
              () => setEditing(true),
              () => setEditing(true),
            )}
          >
            <Pencil />
            Edit results…
          </Button>
        </div>
      )}
      {workout && editing && (
        <SessionResultsDialog open workout={workout} exercises={exercises} initial={s.results} initialNotes={s.notes} onSave={(r, n) => void saveResults(r, n)} onDiscard={() => setEditing(false)} />
      )}
    </div>
  );
}
