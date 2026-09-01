import { useState } from "react";
import { addDays, formatHuman, todayStr } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clearMood, setMood, useMoodsByDate } from "../data/repo";
import { MOOD_STEPS, type MoodLevel } from "../domain/types";

/**
 * The palette's "Set mood…": five buttons for a day, today by default, with
 * a step back for the days you forgot. Future days are refused (ADR 0044).
 */
export function SetMoodDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const today = todayStr();
  const [date, setDate] = useState(today);
  const byDate = useMoodsByDate();
  const current = byDate.get(date) ?? null;

  const pick = async (level: MoodLevel) => {
    if (current === level) await clearMood(date);
    else await setMood(date, level);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setDate(today); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>How was it?</DialogTitle>
        </DialogHeader>
        <div className="flex items-center justify-center gap-1 text-sm">
          <Button variant="ghost" size="icon" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center font-medium">{date === today ? "Today" : formatHuman(date)}</span>
          <Button variant="ghost" size="icon" aria-label="Next day" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {MOOD_STEPS.map((s) => (
            <button
              key={s.level}
              type="button"
              title={`${s.emoji} ${s.label}`}
              onClick={() => void pick(s.level)}
              className={`flex flex-col items-center gap-1 rounded-md border-2 py-3 text-2xl transition-all ${current === s.level ? "border-foreground" : "border-transparent hover:opacity-80"}`}
              style={{ background: s.color }}
            >
              <span>{s.emoji}</span>
              <span className="text-[10px] leading-none text-white/90">{s.label}</span>
            </button>
          ))}
        </div>
        {current !== null && (
          <Button variant="ghost" size="sm" onClick={() => void clearMood(date).then(() => onOpenChange(false))}>
            Clear this day
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
