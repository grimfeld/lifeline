import { useMemo } from "react";
import { Link, useNavigate } from "react-router";
import { excerpt, formatHuman, todayStr, useLinkIndex, type DateStr } from "@lifeline/core";
import { useNotes } from "../data/repo";
import { onThisDay } from "../domain/journalStats";
import { writtenDates } from "../domain/written";
import { PERIOD_KINDS, PERIOD_LABELS, periodKey, periodLabel } from "../domain/periods";
import { DAILY, PERIOD_TYPES, journalHref, periodHref } from "../domain/types";
import { JournalCalendar } from "./JournalCalendar";
import { JournalLinks } from "./JournalLinks";
import { PeriodReports } from "./TypeReports";

const ASIDE = "flex w-64 shrink-0 flex-col gap-5 overflow-y-auto border-l p-3 max-lg:hidden";

/**
 * The Journal's side column beside a Day (ADR 0068): the Day's links first —
 * the names it could link and what links to it — then the calendar (it pages by itself),
 * the stretches the day belongs to (each a review of its own) and the same day
 * in earlier years. On a date with no Day it stays, less the links: there is
 * no Document to link from.
 */
export function JournalAside({ date, docId }: { date: DateStr; docId?: string }) {
  const index = useLinkIndex();
  const navigate = useNavigate();
  const notes = useNotes();
  const dailies = useMemo(() => notes.filter((n) => n.type === DAILY), [notes]);
  const written = useMemo(() => writtenDates(dailies), [dailies]);
  const periods = useMemo(() => new Set(notes.filter((n) => (PERIOD_TYPES as readonly string[]).includes(n.type)).map((n) => n.title)), [notes]);
  const byDate = useMemo(() => new Map(dailies.map((n) => [n.title, n])), [dailies]);
  const earlier = useMemo(() => onThisDay([...written], date, { years: "all", alsoWeeks: false }), [written, date]);

  return (
    <aside className={ASIDE} aria-label="Journal">
      {docId && <JournalLinks docId={docId} index={index} />}
      <JournalCalendar date={date} written={written} onPick={(d) => navigate(journalHref(d, todayStr()))} />
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

/**
 * The side column beside a Week, Month, Quarter or Year: its links, as on a
 * Day, then the period's Reports. A period whose review isn't started keeps
 * the Reports, without links.
 */
export function PeriodAside({ docId, periodKey }: { docId?: string; periodKey: string }) {
  const index = useLinkIndex();
  return (
    <aside className={ASIDE} aria-label="Journal">
      {docId && <JournalLinks docId={docId} index={index} />}
      <PeriodReports periodKey={periodKey} index={index} />
    </aside>
  );
}
