import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { addDays, excerpt, formatHuman, todayStr, useLinkIndex, type DateStr } from "@lifeline/core";
import { cn } from "@lifeline/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useNotes } from "../data/repo";
import { onThisDay } from "../domain/journalStats";
import { PERIOD_KINDS, PERIOD_LABELS, periodKey, periodLabel } from "../domain/periods";
import { DAILY, PERIOD_TYPES, journalHref, periodHref } from "../domain/types";
import { JournalLinks } from "./JournalLinks";
import { PeriodReports } from "./TypeReports";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/** The month around a day as a calendar: written days dotted, today ringed, the open day filled. */
function MiniMonth({ date, written, onPick }: { date: DateStr; written: Set<string>; onPick: (d: DateStr) => void }) {
  const first = `${date.slice(0, 7)}-01`;
  const lead = (new Date(`${first}T00:00:00`).getDay() + 6) % 7;
  const cells: (DateStr | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) cells.push(d);
  const today = todayStr();
  return (
    <div className="grid gap-1">
      <div className="flex items-center gap-1">
        <button type="button" className="hover:bg-accent rounded p-0.5" aria-label="Previous month" onClick={() => onPick(addDays(first, -1))}>
          <ChevronLeft className="size-3.5" />
        </button>
        <Link to={periodHref(periodKey("month", date))} className="flex-1 truncate text-center text-xs font-medium hover:underline">
          {periodLabel(periodKey("month", date))}
        </Link>
        <button type="button" className="hover:bg-accent rounded p-0.5" aria-label="Next month" onClick={() => onPick(addDays(first, 40).slice(0, 7) + "-01")}>
          <ChevronRight className="size-3.5" />
        </button>
      </div>
      <div className="text-muted-foreground grid grid-cols-7 text-center text-[10px]">
        {WEEKDAYS.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              onClick={() => onPick(d)}
              title={formatHuman(d)}
              aria-label={d}
              aria-current={d === date ? "date" : undefined}
              className={cn(
                "relative aspect-square rounded text-[11px] tabular-nums",
                d === date ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                d === today && d !== date && "ring-primary ring-1",
                d > today && "opacity-40",
              )}
            >
              {Number(d.slice(-2))}
              {written.has(d) && d !== date && <span className="bg-primary absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full" />}
            </button>
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
    </div>
  );
}

const ASIDE = "flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-l p-3 max-lg:hidden";

/**
 * The Journal's side column beside a Day (ADR 0068): the Day's links first —
 * the names it could link and what links to it — then the month at a glance,
 * the stretches the day belongs to (each a review of its own) and the same day
 * in earlier years.
 */
export function JournalAside({ date, docId }: { date: DateStr; docId?: string }) {
  const index = useLinkIndex();
  const navigate = useNavigate();
  const notes = useNotes();
  const dailies = useMemo(() => notes.filter((n) => n.type === DAILY), [notes]);
  const written = useMemo(() => new Set(dailies.map((n) => n.title)), [dailies]);
  const periods = useMemo(() => new Set(notes.filter((n) => (PERIOD_TYPES as readonly string[]).includes(n.type)).map((n) => n.title)), [notes]);
  const byDate = useMemo(() => new Map(dailies.map((n) => [n.title, n])), [dailies]);
  const earlier = useMemo(() => onThisDay([...written], date, { years: "all", alsoWeeks: false }), [written, date]);

  return (
    <aside className={ASIDE} aria-label="Journal">
      {docId && <JournalLinks docId={docId} index={index} />}
      <MiniMonth date={date} written={written} onPick={(d) => navigate(journalHref(d, todayStr()))} />
      <section className="grid gap-1">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Reviews</h2>
        {PERIOD_KINDS.map((k) => {
          const key = periodKey(k, date);
          return (
            <Link key={k} to={periodHref(key)} className="hover:bg-accent flex min-w-0 items-center gap-2 rounded px-1.5 py-1 text-sm">
              <span className="text-muted-foreground w-14 shrink-0 text-xs">{PERIOD_LABELS[k].one}</span>
              <span className="min-w-0 flex-1 truncate">{periodLabel(key)}</span>
              {periods.has(key) && <span className="bg-primary size-1.5 shrink-0 rounded-full" title="Written" />}
            </Link>
          );
        })}
      </section>
      <section className="grid gap-1">
        <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">On this day</h2>
        {earlier.length === 0 ? (
          <p className="text-muted-foreground text-xs">Nothing from earlier years yet.</p>
        ) : (
          earlier.map((h) => (
            <Link key={h.date} to={journalHref(h.date)} className="hover:bg-accent grid min-w-0 gap-0.5 rounded px-1.5 py-1">
              <span className="text-xs font-medium">{formatHuman(h.date)}</span>
              <span className="text-muted-foreground line-clamp-2 text-xs">{excerpt(byDate.get(h.date)?.body ?? "", 160)}</span>
            </Link>
          ))
        )}
      </section>
    </aside>
  );
}

/** The side column beside a Week, Month, Quarter or Year: its links, as on a Day, then the period's Reports. */
export function PeriodAside({ docId, periodKey }: { docId: string; periodKey: string }) {
  const index = useLinkIndex();
  return (
    <aside className={ASIDE} aria-label="Links">
      <JournalLinks docId={docId} index={index} />
      <PeriodReports periodKey={periodKey} index={index} />
    </aside>
  );
}
