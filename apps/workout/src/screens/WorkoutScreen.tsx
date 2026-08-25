import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Badge, Button, Card, CardContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, TagChips, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import { Dumbbell, MoreHorizontal, Pencil, Play, Plus, Trash2, Trophy } from "lucide-react";
import { describeBlock, describeWorkout } from "../domain/intervals";
import { formatMeasure, prOf } from "../domain/prs";
import { MODE_LABEL, WORKOUT_HREF, type Exercise, type Session, type Workout } from "../domain/types";
import { deleteExercise, deleteSession, deleteWorkout, useExercises, useSessions, useWorkouts } from "../data/repo";
import { WorkoutEditorDialog } from "../components/WorkoutEditorDialog";
import { ExerciseEditorDialog } from "../components/ExerciseEditorDialog";

const TABS = ["workouts", "exercises", "sessions", "prs"] as const;
type Tab = (typeof TABS)[number];

export function runHref(workoutId: string): string {
  return `${WORKOUT_HREF}/run/${workoutId}`;
}

function WorkoutRow({ w, exercises, onEdit }: { w: Workout; exercises: Map<string, Exercise>; onEdit: (w: Workout) => void }) {
  const navigate = useNavigate();
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{w.title}</div>
          <div className="text-muted-foreground truncate text-xs">
            {describeWorkout(w)} · {w.blocks.map((b) => b.label || describeBlock(b)).join(" → ")}
          </div>
          <div className="text-muted-foreground truncate text-xs">
            {Array.from(new Set(w.blocks.flatMap((b) => b.movements.map((m) => exercises.get(m.exerciseId)?.title ?? "?")))).join(", ")}
            <TagChips tags={w.tags} size="xs" className="ml-1 inline-flex" />
          </div>
        </div>
        <Button size="sm" onClick={() => navigate(runHref(w.id))}>
          <Play /> Start
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(w)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deleteWorkout(w.id);
                toast.success("Workout deleted — its sessions stay");
              }}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function ExerciseRow({ e, sessions, onEdit }: { e: Exercise; sessions: Session[]; onEdit: (e: Exercise) => void }) {
  const pr = useMemo(() => prOf(e, sessions), [e, sessions]);
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{e.title}</div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-1.5 truncate text-xs">
            <Badge variant="outline">{e.category}</Badge>
            {e.equipment && <span>{e.equipment}</span>}
            <span>· {e.measure}</span>
            <TagChips tags={e.tags} size="xs" />
          </div>
        </div>
        {pr.best !== null && (
          <Badge variant="secondary" className="tabular-nums" title={`PR on ${pr.bestDate}`}>
            <Trophy className="mr-1 size-3" /> {formatMeasure(e.measure, pr.best)}
          </Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(e)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() =>
                deleteExercise(e.id)
                  .then(() => toast.success("Exercise deleted"))
                  .catch((err: Error) => toast.error(err.message))
              }
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

function SessionRow({ s, workouts, exercises }: { s: Session; workouts: Map<string, Workout>; exercises: Map<string, Exercise> }) {
  const w = workouts.get(s.workoutId);
  const summary = s.results
    .map((r) => {
      const label = w?.blocks.find((b) => b.id === r.blockId)?.label || MODE_LABEL[r.mode];
      if (r.mode === "amrap") return `${label} ${r.rounds ?? 0}${r.extraReps ? `+${r.extraReps}` : ""}`;
      if (r.mode === "fortime") return `${label} ${r.seconds === null ? "cap" : `${Math.floor(r.seconds / 60)}:${String(r.seconds % 60).padStart(2, "0")}`}`;
      return `${label} ${r.rounds ?? "?"} rds`;
    })
    .join(" · ");
  return (
    <Card className="py-3">
      <CardContent className="flex items-center gap-3 px-4">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{w?.title ?? s.title}</div>
          <div className="text-muted-foreground truncate text-xs">
            {formatHuman(s.date)} · {s.start}–{s.end} · {s.durationMin} min
          </div>
          <div className="text-muted-foreground truncate text-xs">{summary}</div>
          {s.notes && <div className="text-muted-foreground truncate text-xs italic">{s.notes}</div>}
        </div>
        <span className="text-muted-foreground text-xs" title={Array.from(new Set(s.results.flatMap((r) => r.movements.map((m) => exercises.get(m.exerciseId)?.title ?? "?")))).join(", ")}>
          {s.results.reduce((n, r) => n + r.movements.length, 0)} mv
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Delete session"
          onClick={() => {
            void deleteSession(s.id);
            toast.success("Session deleted");
          }}
        >
          <Trash2 />
        </Button>
      </CardContent>
    </Card>
  );
}

function PRTable({ exercises, sessions }: { exercises: Exercise[]; sessions: Session[] }) {
  const rows = exercises.map((e) => ({ e, pr: prOf(e, sessions) })).filter((r) => r.pr.best !== null);
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground p-6 text-center text-sm">No PRs yet — they appear as sessions are saved with results.</CardContent>
      </Card>
    );
  }
  return (
    <div className="grid gap-2">
      {rows.map(({ e, pr }) => (
        <Card key={e.id} className="py-3">
          <CardContent className="flex flex-wrap items-center gap-3 px-4">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{e.title}</div>
              <div className="text-muted-foreground text-xs">
                {formatMeasure(e.measure, pr.best!)} · {pr.bestDate && formatHuman(pr.bestDate)}
              </div>
            </div>
            {pr.repTable.length > 0 && (
              <div className="flex gap-1.5">
                {pr.repTable.map((r) => (
                  <Badge key={r.reps} variant="outline" className="tabular-nums" title={r.date}>
                    {r.reps}RM {r.load} kg
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** The Workout App's screen: Workouts to start, the Exercise library, past Sessions, PRs. */
export function WorkoutScreen() {
  const workouts = useWorkouts();
  const exercises = useExercises();
  const sessions = useSessions();
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const woById = useMemo(() => new Map(workouts.map((w) => [w.id, w])), [workouts]);
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "workouts";
  const [workoutOpen, setWorkoutOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | undefined>();
  const [exerciseOpen, setExerciseOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | undefined>();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Dumbbell className="size-6" /> Workout
        </h1>
        {tab === "workouts" && (
          <Button
            onClick={() => {
              setEditingWorkout(undefined);
              setWorkoutOpen(true);
            }}
          >
            <Plus /> New workout
          </Button>
        )}
        {tab === "exercises" && (
          <Button
            onClick={() => {
              setEditingExercise(undefined);
              setExerciseOpen(true);
            }}
          >
            <Plus /> New exercise
          </Button>
        )}
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams(v === "workouts" ? {} : { tab: v })}>
        <TabsList className="max-w-full overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="workouts">Workouts ({workouts.length})</TabsTrigger>
          <TabsTrigger value="exercises">Exercises ({exercises.length})</TabsTrigger>
          <TabsTrigger value="sessions">Sessions ({sessions.length})</TabsTrigger>
          <TabsTrigger value="prs">PRs</TabsTrigger>
        </TabsList>

        <TabsContent value="workouts" className="grid gap-2 pt-4">
          {workouts.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-center text-sm">No workouts yet. A workout is blocks of intervals — EMOM, AMRAP, Tabata, For Time — with the exercises in each; start one and the timer takes over.</CardContent>
            </Card>
          )}
          {workouts.map((w) => (
            <WorkoutRow
              key={w.id}
              w={w}
              exercises={exById}
              onEdit={(x) => {
                setEditingWorkout(x);
                setWorkoutOpen(true);
              }}
            />
          ))}
        </TabsContent>
        <TabsContent value="exercises" className="grid gap-2 pt-4">
          {exercises.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-center text-sm">No exercises yet. The library is yours to curate: name, category, and the one measure a PR is counted in.</CardContent>
            </Card>
          )}
          {exercises.map((e) => (
            <ExerciseRow
              key={e.id}
              e={e}
              sessions={sessions}
              onEdit={(x) => {
                setEditingExercise(x);
                setExerciseOpen(true);
              }}
            />
          ))}
        </TabsContent>
        <TabsContent value="sessions" className="grid gap-2 pt-4">
          {sessions.length === 0 && (
            <Card>
              <CardContent className="text-muted-foreground p-6 text-center text-sm">No sessions yet. Each run of a workout lands here, on the Schedule, and in the day's Journal.</CardContent>
            </Card>
          )}
          {sessions.map((s) => (
            <SessionRow key={s.id} s={s} workouts={woById} exercises={exById} />
          ))}
        </TabsContent>
        <TabsContent value="prs" className="pt-4">
          <PRTable exercises={exercises} sessions={sessions} />
        </TabsContent>
      </Tabs>

      <WorkoutEditorDialog open={workoutOpen} onOpenChange={setWorkoutOpen} workout={editingWorkout} />
      <ExerciseEditorDialog open={exerciseOpen} onOpenChange={setExerciseOpen} exercise={editingExercise} />
    </div>
  );
}
