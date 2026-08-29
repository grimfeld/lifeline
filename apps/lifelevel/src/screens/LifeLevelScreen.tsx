import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Card, CardContent } from "@lifeline/ui";
import { Plus, Skull, Volume2, VolumeX } from "lucide-react";
import { computeProgression } from "../domain/progression";
import { habitHref } from "../domain/daylog";
import type { Negative } from "../domain/types";
import { useHabitCompletions, useHabits, useNegativeCompletions, useNegatives, useProgressionNow } from "../data/repo";
import { useAudioPref } from "../feedback/feedback";
import { HabitCard } from "../components/HabitCard";
import { NegativeCard } from "../components/NegativeCard";
import { HabitEditorDialog } from "../components/HabitEditorDialog";
import { NegativeEditorDialog } from "../components/NegativeEditorDialog";

/** The Life Level dashboard: every Habit's track, every Negative's trigger. */
export function LifeLevelScreen() {
  const habits = useHabits();
  const negatives = useNegatives();
  const habitCompletions = useHabitCompletions();
  const negativeCompletions = useNegativeCompletions();
  const now = useProgressionNow();
  const navigate = useNavigate();
  const { muted, toggle } = useAudioPref();
  const [habitEditorOpen, setHabitEditorOpen] = useState(false);
  const [negativeEditorOpen, setNegativeEditorOpen] = useState(false);
  const [editNegative, setEditNegative] = useState<Negative | undefined>(undefined);

  const progression = useMemo(
    () => computeProgression(habits, negatives, habitCompletions, negativeCompletions, now),
    [habits, negatives, habitCompletions, negativeCompletions, now],
  );
  const habitById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-4 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Life Level</h1>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="size-8" title={muted ? "Unmute sounds" : "Mute sounds"} onClick={toggle}>
            {muted ? <VolumeX /> : <Volume2 />}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setEditNegative(undefined);
              setNegativeEditorOpen(true);
            }}
          >
            <Skull /> New negative
          </Button>
          <Button onClick={() => setHabitEditorOpen(true)}>
            <Plus /> New habit
          </Button>
        </div>
      </div>

      {habits.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">
            No habits yet. Pick a virtue and start levelling — standing still loses ground.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {progression.habits.map((s) => (
            <HabitCard key={s.habitId} state={s} now={now} onOpen={() => navigate(habitHref(s.habitId))} />
          ))}
        </div>
      )}

      <section className="grid gap-3">
        <h2 className="text-muted-foreground text-sm font-medium">Negatives</h2>
        {negatives.length === 0 ? (
          <p className="text-muted-foreground text-sm">No negative activities. Name your vices — logging them is the deal you made with yourself.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {progression.negatives.map((s) => {
              const rival = s.affectsHabitId ? habitById.get(s.affectsHabitId) : undefined;
              return (
                <NegativeCard
                  key={s.negativeId}
                  state={s}
                  rivalTitle={rival?.title}
                  rivalMissing={!!s.affectsHabitId && !rival}
                  noHabits={habits.length === 0}
                  onOpen={() => {
                    const n = negatives.find((x) => x.id === s.negativeId);
                    if (n) {
                      setEditNegative(n);
                      setNegativeEditorOpen(true);
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      <HabitEditorDialog open={habitEditorOpen} onOpenChange={setHabitEditorOpen} />
      <NegativeEditorDialog open={negativeEditorOpen} onOpenChange={setNegativeEditorOpen} negative={editNegative} />
    </div>
  );
}
