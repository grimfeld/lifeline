import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Button, Input } from "@lifeline/ui";
import { addDays, formatHuman, todayStr, type DateStr } from "@lifeline/core";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { ensureDailyNote, useNoteIndex, useNotes } from "../data/repo";
import { NoteEditor } from "../components/NoteEditor";

/**
 * The Journal Surface: date-navigated daily notes. Today opens directly; a
 * missing day shows a "start writing" state and is created from the daily
 * template on demand (never on mere navigation).
 */
export function JournalScreen() {
  const [params, setParams] = useSearchParams();
  const today = todayStr();
  const date: DateStr = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") ?? "") ? params.get("d")! : today;
  const notes = useNotes();
  const index = useNoteIndex();
  const note = notes.find((n) => n.type === "daily" && n.title === date);
  const [creating, setCreating] = useState(false);
  const go = (d: DateStr) => setParams(d === today ? {} : { d });

  // Today's note is created on first visit so writing can start immediately
  // (ensureDailyNote checks the database itself, so a not-yet-loaded live query can't cause a duplicate).
  useEffect(() => {
    if (date !== today || note || creating) return;
    setCreating(true);
    void ensureDailyNote(today).finally(() => setCreating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, today, note?.id]);

  const daysWithNotes = new Set(notes.filter((n) => n.type === "daily").map((n) => n.title));
  const strip = Array.from({ length: 14 }, (_, i) => addDays(date, i - 10));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Button size="icon" variant="ghost" className="size-8" onClick={() => go(addDays(date, -1))} aria-label="Previous day">
          <ChevronLeft />
        </Button>
        <Button size="icon" variant="ghost" className="size-8" onClick={() => go(addDays(date, 1))} aria-label="Next day">
          <ChevronRight />
        </Button>
        <Button variant={date === today ? "secondary" : "outline"} className="h-8" onClick={() => go(today)}>
          Today
        </Button>
        <Input type="date" className="h-8 w-40" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Jump to date" />
        <div className="ml-auto hidden items-center gap-1 lg:flex">
          {strip.map((d) => (
            <button
              key={d}
              onClick={() => go(d)}
              title={formatHuman(d)}
              aria-label={d}
              className={`size-6 rounded text-[10px] tabular-nums ${d === date ? "bg-primary text-primary-foreground" : daysWithNotes.has(d) ? "bg-muted hover:bg-accent" : "text-muted-foreground hover:bg-accent"} ${d > today ? "opacity-40" : ""}`}
            >
              {Number(d.slice(-2))}
            </button>
          ))}
        </div>
      </div>
      {note ? (
        <NoteEditor key={note.id} note={note} index={index} autoFocus={date === today} />
      ) : (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 text-sm">
          <div>
            No entry for <span className="text-foreground font-medium">{formatHuman(date)}</span>.
          </div>
          <Button onClick={() => void ensureDailyNote(date)}>
            <PenLine /> Start writing
          </Button>
        </div>
      )}
    </div>
  );
}
