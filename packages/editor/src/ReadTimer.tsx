import { useEffect, useState } from "react";
import { Button, Tip, cn } from "@lifeline/ui";
import { useWakeLock } from "@lifeline/core";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { elapsedSeconds, formatClock, pauseClock, resumeClock, startClock, type TalkClock } from "./talkClock";

/**
 * A stopwatch under a Document being read aloud, for types that ask for it
 * (`DocumentTypeDef.readTimer` — today a Writing, which is what a Talk is made
 * of). Start, pause, reset: no target and no bell, because a talk is paced
 * against the clock rather than run by it, and something that interrupts you
 * mid-sentence is worse than no timer at all.
 *
 * Sits under the text and not in the header: the header recedes while writing
 * (ADR 0021, amended) and is the first thing to go on a phone, and a clock that
 * disappears halfway through a talk is the one moment it was there for.
 */
export function ReadTimer() {
  const [clock, setClock] = useState<TalkClock | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const running = !!clock && clock.pausedAt === null;
  // Lit while it runs: a talk is read from the page without touching it, and
  // the screen would otherwise sleep mid-sentence.
  useWakeLock(running);

  // Twice a second: the reading is derived from instants, so this only decides
  // how soon the digits catch up, never what they say.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, [running]);

  const elapsed = clock ? elapsedSeconds(clock, now) : 0;
  const toggle = () => {
    const at = Date.now();
    setNow(at);
    setClock((c) => (!c ? startClock(at) : c.pausedAt === null ? pauseClock(c, at) : resumeClock(c, at)));
  };

  return (
    <div className="flex shrink-0 items-center gap-2 border-t py-2">
      <Timer className={cn("size-4 shrink-0", running ? "text-primary" : "text-muted-foreground")} />
      <span className={cn("font-mono text-lg tabular-nums", !clock && "text-muted-foreground")} aria-label="Time elapsed" role="timer">
        {formatClock(elapsed)}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <Button size="sm" variant={running ? "secondary" : "default"} onClick={toggle} aria-label={running ? "Pause the timer" : clock ? "Resume the timer" : "Start the timer"}>
          {running ? <Pause /> : <Play />}
          {running ? "Pause" : clock ? "Resume" : "Start"}
        </Button>
        <Tip label="Reset the timer">
          <Button
            size="icon"
            variant="ghost"
            // Only once there is something to clear, so the row does not offer a
            // button that does nothing before the talk has started.
            disabled={!clock}
            onClick={() => setClock(null)}
          >
            <RotateCcw />
          </Button>
        </Tip>
      </div>
    </div>
  );
}
