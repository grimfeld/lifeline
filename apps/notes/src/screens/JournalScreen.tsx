import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Button, Input, PhoneDock, cn } from "@lifeline/ui";
import { addDays, documentType, formatHuman, todayStr, useDocuments, useLinkIndex, type DateStr } from "@lifeline/core";
import { DocumentEditor } from "@lifeline/editor";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { DAILY, JOURNAL_HREF, journalHref, type Note } from "../domain/types";
import { nearestWrittenDay, type Nearest } from "../domain/nearest";
import { isWrittenDay } from "../domain/written";
import { JournalAside } from "../components/JournalAside";
import { JournalLinksButton } from "../components/JournalLinks";
import { useJournalPaging } from "../components/useJournalPaging";
import { ensureDailyNote } from "../data/repo";

/**
 * /app/journal?d=YYYY-MM-DD — the Journal's Day page (ADR 0068): the Day
 * written in the Journal's own interface, with a date toolbar (in the phone
 * dock above the Phone bar on a phone) and, on a wide desk, the month, the
 * reviews the day belongs to and the same day in earlier years beside it.
 * Today's Day is created on first visit so writing can start immediately.
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
  useJournalPaging(dailies, date, go);
  const daysWithNotes = new Set(dailies.map((n) => n.title));
  // A Day holding only its Template is not written either: both offer the nearest written Days.
  const near = isWrittenDay(note) ? undefined : nearestWrittenDay(dailies, date);
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
      <PhoneDock>
        <div className="flex items-center gap-2 border-b px-4 py-1.5 max-md:contents">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => go(addDays(date, -1))} aria-label="Previous day">
            <ChevronLeft />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => go(addDays(date, 1))} aria-label="Next day">
            <ChevronRight />
          </Button>
          <Button variant={date === today ? "secondary" : "outline"} className="h-7" onClick={() => go(today)}>
            Today
          </Button>
          <Input type="date" className="h-7 w-36 max-md:w-auto" value={date} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Jump to date" />
          {note && <JournalLinksButton docId={note.id} index={index} />}
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
          <div className="text-muted-foreground ml-auto truncate text-xs max-md:hidden">{note?.folder ? `/ ${note.folder.split("/").join(" / ")} /` : ""}</div>
        </div>
      </PhoneDock>
      <div className="flex min-h-0 flex-1">
        {note ? (
          <div className="flex min-w-0 flex-1 flex-col">
            {near && <NearestDays near={near} today={today} className="border-b px-4 py-1" />}
            <DocumentEditor key={note.id} doc={note} def={def} index={index} docDate={date} autoFocus={date === today} linksPanel={false} onDeleted={() => navigate(JOURNAL_HREF)} />
          </div>
        ) : (
          <div className="text-muted-foreground flex min-w-0 flex-1 flex-col items-center justify-center gap-3 p-4 text-center text-sm">
            <div>
              No entry for <span className="text-foreground font-medium">{formatHuman(date)}</span>.
            </div>
            <Button onClick={() => void ensureDailyNote(date)}>
              <PenLine /> Start writing
            </Button>
            {near && <NearestDays near={near} today={today} />}
          </div>
        )}
        {/* Kept on a date with no Day, so the calendar stays to carry on from (#206). */}
        <JournalAside date={date} docId={note?.id} />
      </div>
    </div>
  );
}

/** Links to the nearest written Day before and after an unwritten date, each with its date; nothing when there is none either way. */
function NearestDays({ near, today, className }: { near: Nearest<DateStr>; today: DateStr; className?: string }) {
  if (!near.before && !near.after) return null;
  return (
    <nav aria-label="Nearest written Days" className={cn("flex max-w-full flex-wrap items-center justify-center gap-2", className)}>
      {near.before && (
        <Button asChild size="sm" variant="ghost" className="max-w-full min-w-0">
          <Link to={journalHref(near.before, today)} aria-label={`Previous written Day, ${formatHuman(near.before)}`}>
            <ArrowLeft /> <span className="truncate">{formatHuman(near.before)}</span>
          </Link>
        </Button>
      )}
      {near.after && (
        <Button asChild size="sm" variant="ghost" className="max-w-full min-w-0">
          <Link to={journalHref(near.after, today)} aria-label={`Next written Day, ${formatHuman(near.after)}`}>
            <span className="truncate">{formatHuman(near.after)}</span> <ArrowRight />
          </Link>
        </Button>
      )}
    </nav>
  );
}
