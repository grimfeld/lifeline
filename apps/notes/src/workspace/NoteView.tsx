import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Button, Input } from "@lifeline/ui";
import { addDays, formatHuman, todayStr, type DateStr } from "@lifeline/core";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import type { Note } from "../domain/types";
import type { NoteIndex } from "../domain/index";
import { ensureDailyNote, useNotes } from "../data/repo";
import { NoteEditor } from "../components/NoteEditor";
import { journalHref } from "./useOpenNote";

/** Breadcrumb of the note's folder path. */
function Breadcrumb({ folder }: { folder: string }) {
  const parts = folder ? folder.split("/") : [];
  return (
    <div className="text-muted-foreground flex min-w-0 items-center gap-1 truncate text-xs">
      <span>/</span>
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-1">
          <span>{p}</span>
          <span>/</span>
        </span>
      ))}
    </div>
  );
}

/**
 * The centre column of the Notes workspace: breadcrumb (+ the Journal's date
 * toolbar when the note is a daily note — the Journal is "the daily note
 * open here", ADR 0012) and the editor.
 */
export function NoteView({ note, index, date }: { note: Note | undefined; index: NoteIndex; date?: DateStr }) {
  const navigate = useNavigate();
  const notes = useNotes();
  const today = todayStr();
  const isDaily = !!date;
  const go = (d: DateStr) => navigate(journalHref(d));
  const daysWithNotes = new Set(notes.filter((n) => n.type === "daily").map((n) => n.title));
  const strip = date ? Array.from({ length: 14 }, (_, i) => addDays(date, i - 10)) : [];

  // Today's note is created on first visit so writing can start immediately.
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (!isDaily || date !== today || note || creating) return;
    setCreating(true);
    void ensureDailyNote(today).finally(() => setCreating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDaily, date, today, note?.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-1.5">
        {isDaily && date && (
          <>
            <Button size="icon" variant="ghost" className="size-7" onClick={() => go(addDays(date, -1))} aria-label="Previous day">
              <ChevronLeft />
            </Button>
            <Button size="icon" variant="ghost" className="size-7" onClick={() => go(addDays(date, 1))} aria-label="Next day">
              <ChevronRight />
            </Button>
            <Button variant={date === today ? "secondary" : "outline"} className="h-7" onClick={() => go(today)}>
              Today
            </Button>
            <Input type="date" className="h-7 w-36" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Jump to date" />
            <div className="hidden items-center gap-1 xl:flex">
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
          </>
        )}
        <div className="ml-auto">{note && <Breadcrumb folder={note.folder} />}</div>
      </div>
      {note ? (
        <NoteEditor key={note.id} note={note} index={index} autoFocus={!isDaily || date === today} />
      ) : isDaily && date ? (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-3 text-sm">
          <div>
            No entry for <span className="text-foreground font-medium">{formatHuman(date)}</span>.
          </div>
          <Button onClick={() => void ensureDailyNote(date)}>
            <PenLine /> Start writing
          </Button>
        </div>
      ) : (
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">Note not found.</div>
      )}
    </div>
  );
}
