import { useState } from "react";
import { addDays, formatHuman, initialText, todayStr, type CommandDialogProps } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { clearMood, setMood, useMoodsByDate } from "../data/repo";
import type { MoodLevel } from "../domain/types";
import { MoodPicker } from "./MoodPicker";

/**
 * The palette's "Set mood…": five buttons for a day, today by default, with
 * a step back for the days you forgot. Future days are refused (ADR 0044).
 */
export function SetMoodDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const today = todayStr();
  // The inline line may name the day (never one still to come).
  const named = initialText(initial, "date");
  const [date, setDate] = useState(named && named < today ? named : today);
  const byDate = useMoodsByDate();
  const current = byDate.get(date) ?? null;

  const pick = async (level: MoodLevel) => {
    if (current === level) await clearMood(date);
    else await setMood(date, level);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) setDate(named && named < today ? named : today); onOpenChange(o); }}>
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
        <MoodPicker current={current} onPick={(l) => void pick(l)} />
        {current !== null && (
          <Button variant="ghost" size="sm" onClick={() => void clearMood(date).then(() => onOpenChange(false))}>
            Clear this day
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
