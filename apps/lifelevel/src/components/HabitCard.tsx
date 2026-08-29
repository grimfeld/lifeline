import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, cn } from "@lifeline/ui";
import { Check, Circle } from "lucide-react";
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

/**
 * Whether this Habit has been completed on today's calendar day — the one thing
 * XP and decay never say out loud, since a completion logged an hour ago and one
 * logged last week both read as "safe". Green and filled means done; a dashed
 * outline means today is still empty. Never a bar: more than once a day is
 * allowed and welcome, so the extra logs are counted, not refused.
 */
export function DoneTodayBadge({
  completionsToday,
  compact = false,
  className,
}: {
  completionsToday: number;
  /** For a dashboard tile, where the row is narrow: just "Today", the colour carries the answer. */
  compact?: boolean;
  className?: string;
}) {
  const done = completionsToday > 0;
  const label = compact ? "Today" : done ? "Done today" : "Not today";
  return (
    <Badge
      variant={done ? "default" : "outline"}
      title={done ? `Already completed today (${completionsToday}×)` : "Not completed today yet"}
      className={cn(done ? "border-transparent bg-emerald-600 text-white dark:bg-emerald-500" : "text-muted-foreground border-dashed", className)}
    >
      {done ? <Check /> : <Circle />}
      {done && completionsToday > 1 ? `${label} ×${completionsToday}` : label}
    </Badge>
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
  const doneToday = state.completionsToday > 0;
  return (
    // The Card draws its edge as a ring, not a border — tint that, or the accent is invisible.
    <Card className={cn("gap-3", shake && "ll-shake", decayImminent ? "ring-rose-400/60" : doneToday && "ring-emerald-500/60")}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="min-w-0 text-base">
            <button type="button" className="block max-w-full truncate text-left hover:underline" onClick={onOpen}>
              {state.name}
            </button>
          </CardTitle>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="tabular-nums">
              Lv <span key={state.level} className="ll-pop">{state.level}</span>
            </Badge>
            <Badge variant="outline">{state.difficulty}</Badge>
            <DoneTodayBadge completionsToday={state.completionsToday} />
          </div>
        </div>
        <Button size="sm" className="shrink-0" variant={doneToday ? "secondary" : "default"} disabled={pending} onClick={() => void quickComplete()}>
          {pending ? "Logging…" : flash ? "Logged!" : doneToday ? "Complete again" : "Complete"}
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
