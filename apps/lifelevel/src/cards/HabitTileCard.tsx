import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Button, CardUnavailable, cn } from "@lifeline/ui";
import type { CardOption, CardProps, CardSettings } from "@lifeline/core";
import { computeProgression } from "../domain/progression";
import { habitHref } from "../domain/daylog";
import { completeHabit, useHabitCompletions, useHabits, useNegativeCompletions, useNegatives, useProgressionNow } from "../data/repo";
import { celebrateCompletion } from "../feedback/feedback";
import { formatTimeUntil, XpBar } from "../components/HabitCard";

/** Options hook for the `habit` setting: every Habit by name. */
export function useHabitTileOptions(): CardOption[] {
  const habits = useHabits();
  return [...habits].sort((a, b) => a.title.localeCompare(b.title)).map((h) => ({ value: h.id, label: h.title }));
}

/** Instance title (a hook, per CardDef.instanceTitle): the chosen Habit's name. */
export function useHabitTileTitle(settings: CardSettings): string {
  const habits = useHabits();
  return habits.find((h) => h.id === settings.habit)?.title ?? "";
}

/** One Habit as a dashboard tile: level, XP bar, decay pressure, one-tap complete. */
export function HabitTileCard({ settings, configure }: CardProps) {
  const habits = useHabits();
  const negatives = useNegatives();
  const habitCompletions = useHabitCompletions();
  const negativeCompletions = useNegativeCompletions();
  const now = useProgressionNow();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);

  const habit = habits.find((h) => h.id === settings.habit);
  const state = useMemo(
    () => (habit ? computeProgression(habits, negatives, habitCompletions, negativeCompletions, now).habits.find((s) => s.habitId === habit.id) : undefined),
    [habit, habits, negatives, habitCompletions, negativeCompletions, now],
  );

  if (!habit || !state) {
    return <CardUnavailable message="Pick a habit for this tile." onConfigure={configure} />;
  }

  async function quickComplete() {
    setPending(true);
    try {
      const r = await completeHabit(habit!.id);
      if (r) celebrateCompletion({ habitTitle: r.habit.title, xpAmount: r.xpAmount, previousLevel: r.previousLevel, nextLevel: r.nextLevel, levelDelta: r.levelDelta });
    } finally {
      setPending(false);
    }
  }

  const debt = state.rawXp < 0;
  return (
    <div className="flex h-full flex-col gap-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <button type="button" className="min-w-0 truncate text-left text-sm font-medium hover:underline" onClick={() => navigate(habitHref(habit.id))}>
          {habit.title}
        </button>
        <Badge variant="secondary" className="tabular-nums">Lv {state.level}</Badge>
      </div>
      <div className="flex items-baseline justify-between">
        <span className={cn("text-2xl font-semibold tabular-nums", debt && "text-rose-500")}>{Math.round(state.rawXp)}</span>
        <span className="text-muted-foreground text-xs">{state.nextDecayAt ? `decay in ${formatTimeUntil(state.nextDecayAt, now)}` : "safe"}</span>
      </div>
      <XpBar state={state} />
      <div className="mt-auto">
        <Button size="sm" className="w-full" disabled={pending} onClick={() => void quickComplete()}>
          {pending ? "Logging…" : "Complete"}
        </Button>
      </div>
    </div>
  );
}
