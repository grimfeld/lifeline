import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from "@lifeline/ui";
import type { ComputedHabitState } from "../domain/types";
import { completeHabit } from "../data/repo";
import { celebrateCompletion, decayWarningOnce, ensureFeedbackStyles, HIT_EVENT } from "../feedback/feedback";

export function formatTimeUntil(nextIso: string, now: Date): string {
  const diffMs = new Date(nextIso).getTime() - now.getTime();
  if (diffMs <= 0) return "Decaying now";
  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** The XP progress bar: 0 progress and a red tone while in debt. */
export function XpBar({ state, className }: { state: ComputedHabitState; className?: string }) {
  const debt = state.rawXp < 0;
  return (
    <div className={cn("bg-muted relative h-2 w-full overflow-hidden rounded-full", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500 ease-out", debt ? "bg-rose-500/60" : "bg-emerald-500")}
        style={{ width: `${Math.round((debt ? 0 : state.progress01) * 100)}%` }}
      />
    </div>
  );
}

/** One Habit on the Life Level screen: level, XP, decay pressure, one-tap complete. */
export function HabitCard({ state, now, onOpen }: { state: ComputedHabitState; now: Date; onOpen: () => void }) {
  const [pending, setPending] = useState(false);
  const [flash, setFlash] = useState(false);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    ensureFeedbackStyles();
    const onHit = (e: Event) => {
      if ((e as CustomEvent<{ habitId: string }>).detail?.habitId !== state.habitId) return;
      setShake(true);
      window.setTimeout(() => setShake(false), 500);
    };
    window.addEventListener(HIT_EVENT, onHit);
    return () => window.removeEventListener(HIT_EVENT, onHit);
  }, [state.habitId]);

  const urgentHours = useMemo(() => {
    if (!state.nextDecayAt) return null;
    return (new Date(state.nextDecayAt).getTime() - now.getTime()) / 3600000;
  }, [state.nextDecayAt, now]);
  const decayImminent = urgentHours != null && urgentHours > 0 && urgentHours <= 2;

  useEffect(() => {
    if (decayImminent) decayWarningOnce(state.habitId, state.name);
  }, [decayImminent, state.habitId, state.name]);

  async function quickComplete() {
    setPending(true);
    try {
      const r = await completeHabit(state.habitId);
      if (r) {
        celebrateCompletion({ habitTitle: r.habit.title, xpAmount: r.xpAmount, previousLevel: r.previousLevel, nextLevel: r.nextLevel, levelDelta: r.levelDelta });
        setFlash(true);
        window.setTimeout(() => setFlash(false), 700);
      }
    } finally {
      setPending(false);
    }
  }

  const debt = state.rawXp < 0;
  return (
    <Card className={cn("gap-3", shake && "ll-shake", decayImminent && "border-rose-400/60")}>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate text-base">
            <button type="button" className="hover:underline" onClick={onOpen}>
              {state.name}
            </button>
          </CardTitle>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="tabular-nums">
              Lv <span key={state.level} className="ll-pop">{state.level}</span>
            </Badge>
            <Badge variant="outline">{state.difficulty}</Badge>
            {state.completionCount > 0 && <span className="text-muted-foreground text-xs">Done {state.completionCount}×</span>}
          </div>
        </div>
        <Button size="sm" disabled={pending} onClick={() => void quickComplete()}>
          {pending ? "Logging…" : flash ? "Logged!" : "Complete"}
        </Button>
      </CardHeader>
      <CardContent className="grid gap-1.5">
        <div className="flex justify-between text-sm font-medium">
          <span>Raw XP</span>
          <span key={Math.round(state.rawXp)} className={cn("ll-pop tabular-nums", debt ? "text-rose-500" : "")}>{Math.round(state.rawXp)}</span>
        </div>
        <div className="text-muted-foreground flex justify-between text-xs">
          <span className={cn(decayImminent && "font-medium text-rose-500")}>
            {state.nextDecayAt ? `Decay in ${formatTimeUntil(state.nextDecayAt, now)}` : "Safe"}
          </span>
          {debt ? (
            <span className="text-rose-500">In debt — climb back to 0 to progress</span>
          ) : (
            <span className="tabular-nums">
              {Math.round(state.expIntoLevel)} / {state.expPerLevel} to next level
            </span>
          )}
        </div>
        <XpBar state={state} />
      </CardContent>
    </Card>
  );
}
