import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button, Input } from "@lifeline/ui";
import { addDays, documentType, formatHuman, todayStr, useDocuments, useLinkIndex, type DateStr } from "@lifeline/core";
import { DocumentEditor } from "@lifeline/editor";
import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { DAILY, journalHref, type Note } from "../domain/types";
import { ensureDailyNote } from "../data/repo";

/**
 * /vault/journal?d=YYYY-MM-DD — the Journal: "the daily note open in the
 * Vault" with a date toolbar (ADR 0012). Today's note is created on first
 * visit so writing can start immediately.
 */
export function JournalScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const today = todayStr();
  const date: DateStr = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") ?? "") ? params.get("d")! : today;
  const dailies = useDocuments<Note>(DAILY);
  const index = useLinkIndex();
  const note = dailies.find((n) => n.title === date);
  const def = documentType(DAILY);
  const go = (d: DateStr) => navigate(journalHref(d, today));
  const daysWithNotes = new Set(dailies.map((n) => n.title));
  const strip = Array.from({ length: 14 }, (_, i) => addDays(date, i - 10));

  const [creating, setCreating] = useState(false);
  useEffect(() => {
    if (date !== today || note || creating) return;
    setCreating(true);
    void ensureDailyNote(today).finally(() => setCreating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, today, note?.id]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-1.5">
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
        <div className="text-muted-foreground ml-auto truncate text-xs">{note?.folder ? `/ ${note.folder.split("/").join(" / ")} /` : ""}</div>
      </div>
      {note ? (
        <DocumentEditor key={note.id} doc={note} def={def} index={index} docDate={date} autoFocus={date === today} onDeleted={() => navigate("/vault/journal")} />
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
