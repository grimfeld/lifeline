import { useMemo } from "react";
import { useNavigate } from "react-router";
import { matchesTagFilter, useTagFilter, type CardProps } from "@lifeline/core";
import { computeProgression } from "../domain/progression";
import { LIFELEVEL_HREF } from "../domain/daylog";
import { useHabitCompletions, useHabits, useNegativeCompletions, useNegatives, useProgressionNow } from "../data/repo";
import { NegativeCard } from "../components/NegativeCard";

/** Capture Card: every Negative activity, one tap from confession. */
export function LogNegativeCard(_props: CardProps) {
  const habits = useHabits();
  const negatives = useNegatives();
  const habitCompletions = useHabitCompletions();
  const negativeCompletions = useNegativeCompletions();
  const now = useProgressionNow();
  const filter = useTagFilter();
  const navigate = useNavigate();

  const states = useMemo(
    () => computeProgression(habits, negatives, habitCompletions, negativeCompletions, now).negatives,
    [habits, negatives, habitCompletions, negativeCompletions, now],
  );
  const habitById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);
  const negativeById = useMemo(() => new Map(negatives.map((n) => [n.id, n])), [negatives]);
  const shown = states.filter((s) => matchesTagFilter(negativeById.get(s.negativeId)?.tags, filter));

  if (shown.length === 0) {
    return <p className="text-muted-foreground p-4 text-sm">No negative activities{filter.length > 0 ? " with these tags" : ""}.</p>;
  }
  return (
    <div className="grid gap-2 overflow-y-auto p-3">
      {shown.map((s) => {
        const rival = s.affectsHabitId ? habitById.get(s.affectsHabitId) : undefined;
        return (
          <NegativeCard
            key={s.negativeId}
            state={s}
            rivalTitle={rival?.title}
            rivalMissing={!!s.affectsHabitId && !rival}
            noHabits={habits.length === 0}
            /* A dashboard Card holds no editor of its own: editing and deleting are on the Life Level screen. */
            onOpen={() => navigate(LIFELEVEL_HREF)}
          />
        );
      })}
    </div>
  );
}
