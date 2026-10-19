import { useState } from "react";
import type { Document } from "@lifeline/core";
import { Button, toast } from "@lifeline/ui";
import { Check, Skull } from "lucide-react";
import { completeHabit, deleteCompletion, editHabit, editNegative, logNegative, useHabits } from "../data/repo";
import { celebrateCompletion, mournNegative } from "../feedback/feedback";
import type { Habit, Negative } from "../domain/types";
import { DifficultyField, GravityField, RivalHabitField } from "./ActivityFields";

const fail = (e: unknown) => toast.error(`Couldn’t save — ${(e as Error).message}`);

/**
 * A Habit's editable Peek (ADR 0085): its Difficulty changed in place (the
 * ledger re-values, as from its editor) and the Habit done without leaving.
 */
export function HabitPeek({ doc }: { doc: Document }) {
  const habit = doc as Habit;
  const [pending, setPending] = useState(false);

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
      <DifficultyField id="habit-peek-difficulty" value={habit.difficulty} onChange={(difficulty) => void editHabit(habit.id, { difficulty }).catch(fail)} />
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
      <GravityField id="negative-peek-gravity" value={negative.gravity} onChange={(gravity) => void editNegative(negative.id, { gravity }).catch(fail)} />
      <RivalHabitField id="negative-peek-rival" value={negative.affectsHabitId ?? ""} habits={habits} onChange={(affectsHabitId) => void editNegative(negative.id, { affectsHabitId }).catch(fail)} />
      <div>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => void log()}>
          <Skull />
          Log it
        </Button>
      </div>
    </div>
  );
}
