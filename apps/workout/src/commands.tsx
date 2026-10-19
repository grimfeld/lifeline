import { useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import type { CommandDef } from "@lifeline/core";
import { Dumbbell, Play, Plus } from "lucide-react";
import { describeWorkout } from "./domain/intervals";
import { WORKOUT_HREF } from "./domain/types";
import { useWorkouts } from "./data/repo";
import { WorkoutEditorDialog } from "./components/WorkoutEditorDialog";
import { ExerciseEditorDialog } from "./components/ExerciseEditorDialog";
import { runHref } from "./screens/WorkoutScreen";

/** "Start workout": pick one, land on the timer. A capture command, so it sits in the phone's "+" sheet. */
function StartWorkoutDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const workouts = useWorkouts();
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Start workout</DialogTitle>
        </DialogHeader>
        <div className="grid gap-1.5">
          {workouts.length === 0 && <p className="text-muted-foreground text-sm">No workouts yet.</p>}
          {workouts.map((w) => (
            <Button
              key={w.id}
              variant="outline"
              className="h-auto justify-start py-2"
              onClick={() => {
                onOpenChange(false);
                navigate(runHref(w.id));
              }}
            >
              <Play />
              <span className="min-w-0 flex-1 truncate text-left">{w.title}</span>
              <span className="text-muted-foreground text-xs">{describeWorkout(w)}</span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewWorkoutDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <WorkoutEditorDialog {...props} />;
}
function NewExerciseDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <ExerciseEditorDialog {...props} />;
}

export const workoutCommands: CommandDef[] = [
  { id: "workout.start", title: "Start workout", keywords: ["workout", "timer", "emom", "amrap", "tabata", "train", "gym"], icon: Play, dialog: StartWorkoutDialog },
  { id: "workout.new", title: "New workout", keywords: ["workout", "create", "emom", "amrap", "tabata"], icon: Plus, dialog: NewWorkoutDialog },
  { id: "workout.new-exercise", title: "New exercise", keywords: ["exercise", "movement", "library", "lift"], icon: Plus, dialog: NewExerciseDialog },
  { id: "workout.open", title: "Go to Workout", keywords: ["workout", "training", "gym", "prs"], icon: Dumbbell, run: ({ navigate }) => navigate(WORKOUT_HREF) },
];
