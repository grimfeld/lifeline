import { cn } from "@lifeline/ui";
import { MOOD_STEPS, type MoodLevel } from "../domain/types";

/** The five moods as buttons, the day's own ringed. Shared by "Set mood…" and a Mood's Peek. */
export function MoodPicker({ current, onPick }: { current: MoodLevel | null; onPick: (level: MoodLevel) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {MOOD_STEPS.map((s) => (
        <button
          key={s.level}
          type="button"
          title={`${s.emoji} ${s.label}`}
          aria-pressed={current === s.level}
          onClick={() => onPick(s.level)}
          className={cn("flex min-w-0 flex-col items-center gap-1 rounded-md border-2 py-3 text-2xl transition-all", current === s.level ? "border-foreground" : "border-transparent hover:opacity-80")}
          style={{ background: s.color }}
        >
          <span>{s.emoji}</span>
          <span className="text-2xs max-w-full truncate leading-none text-white/90">{s.label}</span>
        </button>
      ))}
    </div>
  );
}
