import { useEffect, useState } from "react";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagInput,
  Textarea,
  toast,
} from "@lifeline/ui";
import { newId, normalizeTag, useLoggableTargets, useTagVocabulary, type LoggableTarget } from "@lifeline/core";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { describeBlock, formatClock, workoutSeconds } from "../domain/intervals";
import { defaultBlock, emptyMovement, MODE_LABEL, MODES, type Block, type Exercise, type Mode, type Movement, type Tally, type Workout } from "../domain/types";
import { addWorkout, updateWorkout, useExercises } from "../data/repo";
import { ExerciseEditorDialog } from "./ExerciseEditorDialog";

const NEW_EXERCISE = "__new__";

function num(v: string): number | null {
  const n = Number(v);
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
}

/** Minutes:seconds input backed by a seconds value. */
function ClockInput({ id, value, onChange, className }: { id?: string; value: number; onChange: (seconds: number) => void; className?: string }) {
  const m = Math.floor(value / 60);
  const s = value % 60;
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input id={id} type="number" min={0} className="h-8 w-16 tabular-nums" value={m} onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0) * 60 + s)} aria-label="minutes" />
      <span className="text-muted-foreground text-xs">min</span>
      <Input type="number" min={0} max={59} step={5} className="h-8 w-16 tabular-nums" value={s} onChange={(e) => onChange(m * 60 + Math.min(59, Math.max(0, Number(e.target.value) || 0)))} aria-label="seconds" />
      <span className="text-muted-foreground text-xs">s</span>
    </div>
  );
}

function MovementRow({ m, exercises, onChange, onRemove, onNewExercise }: { m: Movement; exercises: Exercise[]; onChange: (m: Movement) => void; onRemove: () => void; onNewExercise: () => void }) {
  const ex = exercises.find((e) => e.id === m.exerciseId);
  const measure = ex?.measure;
  const field = (key: keyof Movement, label: string, step = 1) => (
    <label className="flex items-center gap-1 text-xs">
      <Input type="number" min={0} step={step} className="h-8 w-20 tabular-nums" value={m[key] === null ? "" : String(m[key])} onChange={(e) => onChange({ ...m, [key]: num(e.target.value) })} aria-label={label} />
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2">
      <Select
        value={m.exerciseId || undefined}
        onValueChange={(v) => {
          if (v === NEW_EXERCISE) onNewExercise();
          else onChange({ ...m, exerciseId: v });
        }}
      >
        <SelectTrigger className="h-8 w-48">
          <SelectValue placeholder="Exercise…" />
        </SelectTrigger>
        <SelectContent>
          {exercises.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.title}
            </SelectItem>
          ))}
          <SelectItem value={NEW_EXERCISE}>+ New exercise…</SelectItem>
        </SelectContent>
      </Select>
      {(measure === "reps" || measure === "load") && field("reps", "reps")}
      {measure === "load" && field("load", "kg", 2.5)}
      {measure === "time" && field("seconds", "s", 5)}
      {measure === "distance" && field("distance", "m", 50)}
      {measure === "calories" && field("calories", "cal")}
      <Input className="h-8 min-w-24 flex-1" placeholder="Cue (optional)" value={m.cue} onChange={(e) => onChange({ ...m, cue: e.target.value })} />
      <Button size="icon" variant="ghost" className="size-8" onClick={onRemove} aria-label="Remove movement">
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function BlockEditor({
  block,
  index,
  count,
  exercises,
  onChange,
  onRemove,
  onMove,
  onNewExercise,
}: {
  block: Block;
  index: number;
  count: number;
  exercises: Exercise[];
  onChange: (b: Block) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
  onNewExercise: (movementIndex: number) => void;
}) {
  const set = (patch: Partial<Block>) => onChange({ ...block, ...patch });
  const setMode = (mode: Mode) => onChange({ ...defaultBlock(block.id, mode), label: block.label, movements: block.movements });
  const rounds = (label = "Rounds") => (
    <label className="flex items-center gap-1 text-xs">
      <Input type="number" min={1} className="h-8 w-16 tabular-nums" value={block.rounds} onChange={(e) => set({ rounds: Math.max(1, Number(e.target.value) || 1) })} />
      <span className="text-muted-foreground">{label}</span>
    </label>
  );
  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-muted-foreground w-5 text-xs tabular-nums">{index + 1}.</span>
        <Select value={block.mode} onValueChange={(v) => setMode(v as Mode)}>
          <SelectTrigger className="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODES.map((m) => (
              <SelectItem key={m} value={m}>
                {MODE_LABEL[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input className="h-8 min-w-32 flex-1" placeholder="Label (optional)" value={block.label} onChange={(e) => set({ label: e.target.value })} />
        <span className="text-muted-foreground text-xs">{describeBlock(block)}</span>
        <div className="ml-auto flex gap-0.5">
          <Button size="icon" variant="ghost" className="size-8" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
            <ArrowUp className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="Move down">
            <ArrowDown className="size-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="size-8" onClick={onRemove} aria-label="Remove block">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {block.mode === "emom" && (
          <>
            {rounds("Minutes")}
            <label className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">every</span>
              <ClockInput value={block.every} onChange={(every) => set({ every: Math.max(5, every) })} />
            </label>
          </>
        )}
        {(block.mode === "amrap" || block.mode === "fortime") && (
          <label className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">{block.mode === "amrap" ? "Time" : "Cap"}</span>
            <ClockInput value={block.cap} onChange={(cap) => set({ cap: Math.max(10, cap) })} />
          </label>
        )}
        {(block.mode === "tabata" || block.mode === "intervals") && (
          <>
            {rounds()}
            <label className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Work</span>
              <ClockInput value={block.work} onChange={(work) => set({ work: Math.max(1, work) })} />
            </label>
            <label className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">Rest</span>
              <ClockInput value={block.rest} onChange={(rest) => set({ rest: Math.max(0, rest) })} />
            </label>
          </>
        )}
      </div>
      <div className="grid gap-1.5">
        {block.movements.map((m, i) => (
          <MovementRow
            key={i}
            m={m}
            exercises={exercises}
            onChange={(next) => set({ movements: block.movements.map((x, j) => (j === i ? next : x)) })}
            onRemove={() => set({ movements: block.movements.filter((_, j) => j !== i) })}
            onNewExercise={() => onNewExercise(i)}
          />
        ))}
        <Button size="sm" variant="outline" className="w-fit" onClick={() => set({ movements: [...block.movements, emptyMovement()] })}>
          <Plus /> Movement
        </Button>
        <p className="text-muted-foreground text-xs">
          {block.mode === "emom" ? "Movements alternate by minute." : block.mode === "amrap" || block.mode === "fortime" ? "Cycle through the movements each round." : "One movement per work interval, in turn."}
        </p>
      </div>
    </div>
  );
}

function TallyRow({ t, targets, onChange, onRemove }: { t: Tally; targets: LoggableTarget[]; onChange: (t: Tally) => void; onRemove: () => void }) {
  const target = targets.find((x) => x.key === t.target);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm">
      <span className="text-muted-foreground text-xs">tallies to</span>
      <span className="font-medium">{target?.title ?? t.target}</span>
      {target?.subtitle && <span className="text-muted-foreground text-xs">{target.subtitle}</span>}
      {target?.wants === "number" ? (
        <Select value={t.value} onValueChange={(v) => onChange({ ...t, value: v as Tally["value"] })}>
          <SelectTrigger className="h-8 w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="one">+1{target.unit ? ` ${target.unit}` : ""}</SelectItem>
            <SelectItem value="duration">+ duration (min)</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <span className="text-muted-foreground text-xs">one completion</span>
      )}
      <Button size="icon" variant="ghost" className="ml-auto size-8" onClick={onRemove} aria-label="Remove tally">
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

/** A Workout (ADR 0030): Blocks of intervals with their Movements, and the Tallies its Sessions fire (ADR 0031). */
export function WorkoutEditorDialog({ open, onOpenChange, workout }: { open: boolean; onOpenChange: (open: boolean) => void; workout?: Workout }) {
  const exercises = useExercises();
  const targets = useLoggableTargets();
  const suggestions = useTagVocabulary().map((v) => v.tag);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [tallies, setTallies] = useState<Tally[]>([]);
  const [newExercise, setNewExercise] = useState<{ block: number; movement: number } | null>(null);
  const [addTally, setAddTally] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(workout?.title ?? "");
    setNotes(workout?.notes ?? "");
    setTags(workout?.tags ?? []);
    setBlocks(workout?.blocks ?? [defaultBlock(newId(), "tabata")]);
    setTallies(workout?.tallies ?? []);
    setAddTally("");
  }, [open, workout]);

  const setBlock = (i: number, b: Block) => setBlocks((cur) => cur.map((x, j) => (j === i ? b : x)));
  const moveBlock = (i: number, dir: -1 | 1) =>
    setBlocks((cur) => {
      const next = [...cur];
      const j = i + dir;
      if (j < 0 || j >= next.length) return cur;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function submit() {
    if (!title.trim()) return void toast.error("Title required");
    if (blocks.length === 0) return void toast.error("Add at least one block");
    const missing = blocks.find((b) => b.movements.some((m) => !m.exerciseId));
    if (missing) return void toast.error("Every movement needs an exercise");
    const input = { title, notes, tags, blocks, tallies };
    if (workout) {
      await updateWorkout(workout, input);
      toast.success("Workout updated");
    } else {
      await addWorkout(input);
      toast.success("Workout added");
    }
    onOpenChange(false);
  }

  const total = workoutSeconds({ blocks });
  const available = targets.filter((t) => !tallies.some((x) => x.target === t.key));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{workout ? "Edit workout" : "New workout"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="wo-title">Title</Label>
              <Input id="wo-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tuesday conditioning" autoFocus />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Blocks</Label>
                <span className="text-muted-foreground text-xs tabular-nums">{formatClock(total)} total</span>
              </div>
              {blocks.map((b, i) => (
                <BlockEditor key={b.id} block={b} index={i} count={blocks.length} exercises={exercises} onChange={(nb) => setBlock(i, nb)} onRemove={() => setBlocks((cur) => cur.filter((_, j) => j !== i))} onMove={(dir) => moveBlock(i, dir)} onNewExercise={(mi) => setNewExercise({ block: i, movement: mi })} />
              ))}
              <div className="flex flex-wrap gap-1.5">
                {MODES.map((m) => (
                  <Button key={m} size="sm" variant="outline" onClick={() => setBlocks((cur) => [...cur, defaultBlock(newId(), m)])}>
                    <Plus /> {MODE_LABEL[m]}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tallies</Label>
              {tallies.map((t, i) => (
                <TallyRow key={t.target} t={t} targets={targets} onChange={(nt) => setTallies((cur) => cur.map((x, j) => (j === i ? nt : x)))} onRemove={() => setTallies((cur) => cur.filter((_, j) => j !== i))} />
              ))}
              {available.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={addTally || undefined}
                    onValueChange={(key) => {
                      const t = targets.find((x) => x.key === key);
                      if (!t) return;
                      setTallies((cur) => [...cur, { target: key, value: "one" }]);
                      setAddTally("");
                    }}
                  >
                    <SelectTrigger className="h-8 w-64">
                      <SelectValue placeholder="Log each session to…" />
                    </SelectTrigger>
                    <SelectContent>
                      {available.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.title}
                          {t.subtitle ? ` · ${t.subtitle}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground text-xs">A Habit completion or a Stat entry, once per session.</span>
                </div>
              ) : (
                targets.length === 0 && <p className="text-muted-foreground text-xs">No Habits or Stats to tally to yet.</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wo-notes">Notes</Label>
              <Textarea id="wo-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="wo-tags">Tags</Label>
              <TagInput id="wo-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()}>{workout ? "Save" : "Add workout"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ExerciseEditorDialog
        open={newExercise !== null}
        onOpenChange={(o) => !o && setNewExercise(null)}
        onSaved={(id) => {
          if (!newExercise) return;
          const { block, movement } = newExercise;
          setBlocks((cur) => cur.map((b, i) => (i === block ? { ...b, movements: b.movements.map((m, j) => (j === movement ? { ...m, exerciseId: id } : m)) } : b)));
        }}
      />
    </>
  );
}
