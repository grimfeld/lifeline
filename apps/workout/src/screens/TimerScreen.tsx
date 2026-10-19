import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Button, cn, toast } from "@lifeline/ui";
import { ChevronLeft, Flag, Mic, MicOff, Pause, Play, Plus, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { elapsedSeconds, expandWorkout, formatClock, offsetOf, pause, positionAt, resume, skipBack, skipForward, type Interval, type RunClock } from "../domain/intervals";
import { isNewPR } from "../domain/prs";
import { MODE_LABEL, WORKOUT_HREF, type BlockResult, type Workout } from "../domain/types";
import { allSessions, saveSession, useExercises, useWorkout } from "../data/repo";
import { useWakeLock } from "@lifeline/core";
import { arm, beepCount, beepDone, beepGo, beepRest, say, useAudioPrefs } from "../feedback";
import { SessionResultsDialog } from "../components/SessionResultsDialog";

/** Results the timer can fill by itself: AMRAP round taps, For Time stops, rounds reached. */
interface LiveResults {
  amrapRounds: Record<string, number>;
  fortimeSeconds: Record<string, number>;
}

function initialResults(w: Workout, intervals: Interval[], elapsed: number, live: LiveResults): BlockResult[] {
  return w.blocks.map((b, bi) => {
    const reached = intervals.filter((iv) => iv.blockIndex === bi && iv.kind === "work" && offsetOf(intervals, intervals.indexOf(iv)) + iv.seconds <= elapsed + 0.5).length;
    return {
      blockId: b.id,
      mode: b.mode,
      rounds: b.mode === "amrap" ? (live.amrapRounds[b.id] ?? 0) : b.mode === "fortime" ? null : reached,
      extraReps: b.mode === "amrap" ? 0 : null,
      seconds: b.mode === "fortime" ? (live.fortimeSeconds[b.id] ?? null) : null,
      movements: b.movements.map((m) => ({ exerciseId: m.exerciseId, reps: m.reps, load: m.load, seconds: m.seconds, distance: m.distance, calories: m.calories })),
    };
  });
}

/**
 * The timer (ADR 0030; ADR 0021 amendment — the phone's "operate" mode):
 * full-screen digits derived from the run clock, beeps on 3-2-1 and voice on
 * every change, wake lock while running. `/app/workout/run/:id`.
 */
export function TimerScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const workout = useWorkout(id);
  const exercises = useExercises();
  const exById = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);
  const intervals = useMemo(() => (workout ? expandWorkout(workout) : []), [workout]);
  const audio = useAudioPrefs();

  const [clock, setClock] = useState<RunClock | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [live, setLive] = useState<LiveResults>({ amrapRounds: {}, fortimeSeconds: {} });
  const [finished, setFinished] = useState<{ elapsed: number; startedAt: number; endedAt: number } | null>(null);
  const running = !!clock && clock.pausedAt === null && !finished;
  useWakeLock(!!clock && !finished);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);

  const elapsed = clock ? elapsedSeconds(clock, now) : 0;
  const pos = positionAt(intervals, elapsed);
  const current = intervals[pos.index];
  const next = intervals[pos.index + 1];

  // One save per Session: a second tap while the first is in flight would
  // write the Session (and its Tallies) twice.
  const saving = useRef(false);
  const [busy, setBusy] = useState(false);

  // Cues: one per interval change, one per 3-2-1 second, none twice.
  const lastIndex = useRef(-1);
  const lastTick = useRef(-1);
  useEffect(() => {
    if (!clock || finished) return;
    if (pos.done) {
      beepDone();
      say("Done");
      finish();
      return;
    }
    if (pos.index !== lastIndex.current) {
      lastIndex.current = pos.index;
      lastTick.current = -1;
      if (current.kind === "rest") {
        beepRest();
        say("Rest");
      } else if (current.kind === "work") {
        beepGo();
        const name = current.movement ? exById.get(current.movement.exerciseId)?.title : undefined;
        say(name ? `${name}` : current.open ? `${MODE_LABEL[current.mode]}, ${formatClock(current.seconds)}` : "Go");
      }
    }
    const left = Math.ceil(pos.remaining);
    if (left <= 3 && left >= 1 && left !== lastTick.current && pos.remaining > 0.05) {
      lastTick.current = left;
      beepCount();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos.index, Math.ceil(pos.remaining), pos.done, clock, finished]);

  function start() {
    arm();
    lastIndex.current = -1;
    setClock({ startedAt: Date.now(), pausedAt: null, pausedTotal: 0, skipped: 0 });
    setNow(Date.now());
  }
  function togglePause() {
    if (!clock) return;
    const t = Date.now();
    setClock(clock.pausedAt === null ? pause(clock, t) : resume(clock, t));
    setNow(t);
  }
  function finish() {
    if (!clock) return;
    const t = Date.now();
    const c = clock.pausedAt === null ? clock : resume(clock, t);
    setFinished({ elapsed: elapsedSeconds(c, t), startedAt: c.startedAt, endedAt: t });
  }
  function markForTime() {
    if (!clock || !current) return;
    setLive((l) => ({ ...l, fortimeSeconds: { ...l.fortimeSeconds, [current.blockId]: Math.round(pos.into) } }));
    setClock(skipForward(clock, intervals, Date.now()));
  }

  const initial = useMemo(() => (workout && finished ? initialResults(workout, intervals, finished.elapsed, live) : []), [workout, intervals, finished, live]);

  async function save(results: BlockResult[], notes: string) {
    if (!workout || !finished || saving.current) return;
    saving.current = true;
    setBusy(true);
    try {
      const earlier = await allSessions();
      const session = await saveSession({ workout, startedAt: new Date(finished.startedAt).toISOString(), endedAt: new Date(finished.endedAt).toISOString(), results, notes });
      const prs = exercises.filter((e) => isNewPR(e, session, earlier)).map((e) => e.title);
      toast.success(prs.length ? `Session saved — PR: ${prs.join(", ")} 🏆` : "Session saved");
    } catch (err) {
      toast.error((err as Error).message);
    }
    navigate(`${WORKOUT_HREF}?tab=sessions`);
  }

  if (!workout) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center p-6 text-sm">
        That workout is gone.{" "}
        <Button variant="link" onClick={() => navigate(WORKOUT_HREF)}>
          Back to Workout
        </Button>
      </div>
    );
  }

  const total = intervals.reduce((n, iv) => n + iv.seconds, 0);
  const color = !current ? "" : current.kind === "rest" ? "text-sky-500" : current.kind === "prep" ? "text-amber-500" : "text-emerald-500";
  const movementName = current?.movement ? exById.get(current.movement.exerciseId)?.title : undefined;
  const dose = current?.movement
    ? [current.movement.reps && `${current.movement.reps} reps`, current.movement.load && `${current.movement.load} kg`, current.movement.seconds && `${current.movement.seconds} s`, current.movement.distance && `${current.movement.distance} m`, current.movement.calories && `${current.movement.calories} cal`, current.movement.cue].filter(Boolean).join(" · ")
    : "";
  const nextName = next ? (next.kind === "rest" ? "Rest" : next.movement ? (exById.get(next.movement.exerciseId)?.title ?? next.label) : next.label) : "Finish";

  return (
    <div className="flex h-full flex-col select-none">
      <div className="flex items-center gap-1 p-2">
        <Button size="icon" variant="ghost" onClick={() => navigate(WORKOUT_HREF)} aria-label="Back">
          <ChevronLeft />
        </Button>
        <div className="min-w-0 flex-1 truncate text-sm font-medium">{workout.title}</div>
        <Button size="icon" variant="ghost" onClick={audio.toggleVoice} aria-label="Voice" title="Voice cues">
          {audio.voice ? <Mic /> : <MicOff />}
        </Button>
        <Button size="icon" variant="ghost" onClick={audio.toggleMuted} aria-label="Sound" title="Sound">
          {audio.muted ? <VolumeX /> : <Volume2 />}
        </Button>
      </div>

      {!clock ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
          <div className="text-muted-foreground text-sm">{intervals.length - 1} intervals · {formatClock(total)}</div>
          <ol className="text-muted-foreground max-h-48 w-full max-w-sm overflow-y-auto text-xs">
            {workout.blocks.map((b, i) => (
              <li key={b.id} className="flex justify-between py-0.5">
                <span>
                  {i + 1}. {b.label || MODE_LABEL[b.mode]}
                </span>
                <span className="tabular-nums">{b.movements.map((m) => exById.get(m.exerciseId)?.title ?? "?").join(", ")}</span>
              </li>
            ))}
          </ol>
          <Button size="lg" className="h-16 w-48 text-lg" onClick={start}>
            <Play /> Start
          </Button>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <div className={cn("text-sm font-medium uppercase tracking-widest", color)}>
            {current?.kind === "prep" ? "Get ready" : current?.kind === "rest" ? "Rest" : (current?.label ?? "")}
            {current && current.kind !== "prep" && current.rounds > 1 && !current.open && (
              <span className="text-muted-foreground ml-2 normal-case tracking-normal">
                round {current.round}/{current.rounds}
              </span>
            )}
          </div>
          <div className={cn("font-mono text-[22vw] leading-none font-bold tabular-nums md:text-[9rem]", color)}>{formatClock(Math.ceil(pos.remaining))}</div>
          {current?.kind === "work" && (
            <div className="min-h-12">
              <div className="text-2xl font-semibold">{movementName ?? (current.open ? MODE_LABEL[current.mode] : "")}</div>
              {dose && <div className="text-muted-foreground text-sm">{dose}</div>}
              {current.open && current.mode === "amrap" && (
                <div className="text-muted-foreground text-sm">
                  {workout.blocks[current.blockIndex].movements.map((m) => `${m.reps ?? ""} ${exById.get(m.exerciseId)?.title ?? "?"}`.trim()).join(" · ")}
                </div>
              )}
            </div>
          )}
          <div className="text-muted-foreground text-xs">
            next: {nextName} · {formatClock(Math.max(0, total - elapsed))} left
          </div>
          <div className="bg-muted mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full">
            <div className="bg-primary h-full transition-[width]" style={{ width: `${Math.min(100, (elapsed / Math.max(1, total)) * 100)}%` }} />
          </div>

          {current?.open && current.mode === "amrap" && (
            <Button size="lg" className="mt-4 h-20 w-full max-w-sm text-2xl" onClick={() => setLive((l) => ({ ...l, amrapRounds: { ...l.amrapRounds, [current.blockId]: (l.amrapRounds[current.blockId] ?? 0) + 1 } }))}>
              <Plus className="size-7" /> Round {(live.amrapRounds[current.blockId] ?? 0) + 1}
            </Button>
          )}
          {current?.open && current.mode === "fortime" && (
            <Button size="lg" className="mt-4 h-20 w-full max-w-sm text-2xl" onClick={markForTime}>
              <Flag className="size-7" /> Done · {formatClock(pos.into)}
            </Button>
          )}

          <div className="mt-4 flex items-center gap-2">
            <Button size="icon" variant="outline" className="size-14" onClick={() => setClock(skipBack(clock, intervals, Date.now()))} aria-label="Back">
              <SkipBack />
            </Button>
            <Button size="icon" className="size-20" onClick={togglePause} aria-label={running ? "Pause" : "Resume"}>
              {running ? <Pause className="size-8" /> : <Play className="size-8" />}
            </Button>
            <Button size="icon" variant="outline" className="size-14" onClick={() => setClock(skipForward(clock, intervals, Date.now()))} aria-label="Next">
              <SkipForward />
            </Button>
          </div>
          <Button variant="ghost" className="text-muted-foreground mt-2" onClick={finish}>
            <Flag /> Finish early
          </Button>
        </div>
      )}

      {finished && <SessionResultsDialog open workout={workout} exercises={exercises} initial={initial} saving={busy} onSave={(r, n) => void save(r, n)} onDiscard={() => navigate(WORKOUT_HREF)} />}
    </div>
  );
}
