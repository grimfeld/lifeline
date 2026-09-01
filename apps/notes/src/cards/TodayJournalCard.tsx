import { useNavigate } from "react-router";
import { Button } from "@lifeline/ui";
import { addDays, excerpt, formatHuman, todayStr, useDaylog, type CardProps } from "@lifeline/core";
import { PenLine } from "lucide-react";
import { useNotes } from "../data/repo";
import { DAILY, journalHref } from "../domain/types";

/**
 * The Mood App's id. Read through the Daylog Contract, never imported: the
 * day's mood is the Mood App's Document now (ADR 0044), and Notes only shows it.
 */
const MOOD_APP = "mood";

/** Card: preview of a day's journal note (knob: day offset), click to open. */
export function TodayJournalCard({ settings }: CardProps) {
  const offset = Number(settings.offset ?? 0);
  const date = addDays(todayStr(), offset);
  const notes = useNotes();
  const navigate = useNavigate();
  const mood = useDaylog(date, [MOOD_APP])[0];
  const note = notes.find((n) => n.type === DAILY && n.title === date);
  const open = () => navigate(journalHref(date, todayStr()));
  if (!note) {
    return (
      <div className="text-muted-foreground flex h-full flex-col items-center justify-center gap-2 text-sm">
        <span>No entry for {offset === 0 ? "today" : formatHuman(date)}.</span>
        <Button size="sm" variant="outline" onClick={open}>
          <PenLine /> {offset === 0 ? "Write" : "Open"}
        </Button>
      </div>
    );
  }
  const text = excerpt(note.body, 600);
  return (
    <button className="hover:bg-accent/40 flex h-full w-full flex-col gap-1 overflow-hidden rounded-md text-left" onClick={open}>
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span>{formatHuman(date)}</span>
        {mood && <span>{mood.title}</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden text-sm whitespace-pre-line">{text || <span className="text-muted-foreground italic">Empty so far — click to write.</span>}</div>
    </button>
  );
}
