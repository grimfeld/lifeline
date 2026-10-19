import { useState } from "react";
import type { Document } from "@lifeline/core";
import { Button, toast } from "@lifeline/ui";
import { Check, Skull } from "lucide-react";
import { completeHabit, deleteCompletion, editHabit, editNegative, logNegative, useHabits } from "../data/repo";
import { celebrateCompletion, mournNegative } from "../feedback/feedback";
import type { Habit, Negative } from "../domain/types";
import { DifficultyField, GravityField, RivalHabitField } from "./ActivityFields";

/** A write whose refusal shows under its field: the error it set, and the write that sets it. */
function useRefusal(): [string, (write: Promise<unknown>) => void] {
  const [error, setError] = useState("");
  const settle = (write: Promise<unknown>) =>
    void write.then(
      () => setError(""),
      (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
    );
  return [error, settle];
}

/**
 * A Habit's editable Peek (ADR 0085): its Difficulty changed in place (the
 * ledger re-values, as from its editor) and the Habit done without leaving.
 */
export function HabitPeek({ doc }: { doc: Document }) {
  const habit = doc as Habit;
  const [pending, setPending] = useState(false);
  const [difficultyError, settleDifficulty] = useRefusal();

  async function complete() {
    setPending(true);
    try {
      const r = await completeHabit(habit.id);
      if (r)
        celebrateCompletion({
          habitTitle: r.habit.title,
          xpAmount: r.xpAmount,
          previousLevel: r.previousLevel,
          nextLevel: r.nextLevel,
          levelDelta: r.levelDelta,
          onUndo: () => deleteCompletion(r.completionId),
        });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <DifficultyField value={habit.difficulty} error={difficultyError} onChange={(difficulty) => settleDifficulty(editHabit(habit.id, { difficulty }))} />
      <div>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => void complete()}>
          <Check />
          Done
        </Button>
      </div>
    </div>
  );
}

/**
 * A Negative activity's editable Peek (ADR 0085): its Gravity and Rival habit
 * changed in place, and a slip confessed without leaving.
 */
export function NegativePeek({ doc }: { doc: Document }) {
  const negative = doc as Negative;
  const habits = useHabits();
  const [pending, setPending] = useState(false);
  const [gravityError, settleGravity] = useRefusal();
  const [rivalError, settleRival] = useRefusal();

  async function log() {
    setPending(true);
    try {
      const r = await logNegative(negative.id);
      if (r?.ok)
        mournNegative({
          negativeTitle: r.negative.title,
          victimTitle: r.victim.title,
          victimId: r.victim.id,
          damage: r.damage,
          onUndo: () => deleteCompletion(r.completionId),
        });
      else if (r) toast.error(r.reason === "no-habits" ? "No habit to hit — create a habit first" : "Rival habit is gone — re-pair the negative first");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <GravityField value={negative.gravity} error={gravityError} onChange={(gravity) => settleGravity(editNegative(negative.id, { gravity }))} />
      <RivalHabitField value={negative.affectsHabitId ?? ""} habits={habits} error={rivalError} onChange={(affectsHabitId) => settleRival(editNegative(negative.id, { affectsHabitId }))} />
      <div>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => void log()}>
          <Skull />
          Log it
        </Button>
      </div>
    </div>
  );
}
