import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { Button, PhoneDock } from "@lifeline/ui";
import { documentType, excerpt, formatHuman, todayStr, useLinkIndex, useDaylog, type DateStr } from "@lifeline/core";
import { DocumentEditor } from "@lifeline/editor";
import { ChevronLeft, ChevronRight, ChevronUp, PenLine } from "lucide-react";
import { ensurePeriod, useNotes } from "../data/repo";
import { PERIOD_KINDS, PERIOD_LABELS, daysOf, kindOfKey, partsOf, periodKey, periodLabel, periodRange, shiftPeriod, type PeriodKind } from "../domain/periods";
import { DAILY, journalHref, periodHref, type Note } from "../domain/types";
import { PeriodAside } from "../components/JournalAside";
import { JournalLinksButton } from "../components/JournalLinks";

/** The stretch one step coarser: a Week's Month (by its Thursday), a Month's Quarter, a Quarter's Year. */
function parentOf(key: string): string | undefined {
  const kind = kindOfKey(key);
  const r = periodRange(key);
  if (!kind || !r) return undefined;
  const next: Partial<Record<PeriodKind, PeriodKind>> = { week: "month", month: "quarter", quarter: "year" };
  const up = next[kind];
  if (!up) return undefined;
  const anchor = kind === "week" ? daysOf(key)[3] : r.from;
  return periodKey(up, anchor);
}

/** A Day's own words: its body without headings, rules, the daylog block and the lines its Template left empty. */
export function ownWords(body: string): string {
  return body
    .replace(/```daylog[\s\S]*?```/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^#{1,6}\s/.test(l) && !/^(-{3,}|\*{3,}|_{3,})$/.test(l) && !/^\d+\.\s*$/.test(l) && !/^[-*]\s*$/.test(l))
    .join(" ");
}

/** One day of the stretch: its Day's opening words and what happened on it. */
function DayRow({ date, day }: { date: DateStr; day: Note | undefined }) {
  const happened = useDaylog(date);
  if (!day && happened.length === 0) return null;
  const kinds = new Map<string, number>();
  for (const it of happened) kinds.set(it.kind, (kinds.get(it.kind) ?? 0) + 1);
  return (
    <Link to={journalHref(date)} className="hover:bg-accent/40 grid min-w-0 gap-0.5 rounded-md border px-3 py-2">
      <div className="flex min-w-0 items-baseline gap-2">
        <span className="shrink-0 text-sm font-medium">{formatHuman(date)}</span>
        {!day && <span className="text-muted-foreground text-xs">not written</span>}
      </div>
      {day && ownWords(day.body) && <span className="text-muted-foreground line-clamp-2 min-w-0 text-sm">{excerpt(ownWords(day.body), 200)}</span>}
      {kinds.size > 0 && (
        <span className="text-muted-foreground min-w-0 truncate text-xs">
          {[...kinds].map(([k, n]) => (n > 1 ? `${k} ×${n}` : k)).join(" · ")}
        </span>
      )}
    </Link>
  );
}

/**
 * /app/journal/p/:key — a review stretch (CONTEXT.md "Week, Month, Quarter,
 * Year"): its own Document, written from its Template, then what lies inside
 * it — a Week's and a Month's days with what happened on them, a Quarter's
 * Months and a Year's Quarters. "week", "month"… stand for the current one.
 */
export function PeriodScreen() {
  const { key: raw = "" } = useParams();
  const navigate = useNavigate();
  const today = todayStr();
  const notes = useNotes();
  const index = useLinkIndex();
  const current = (PERIOD_KINDS as string[]).includes(raw) ? periodKey(raw as PeriodKind, today) : undefined;
  const key = current ?? raw;
  const kind = kindOfKey(key);
  const doc = notes.find((n) => n.type === kind && n.title === key);
  const [creating, setCreating] = useState(false);
  const isCurrent = !!kind && periodKey(kind, today) === key;
  useEffect(() => {
    if (!kind || doc || creating || !isCurrent) return;
    setCreating(true);
    void ensurePeriod(key).finally(() => setCreating(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, doc?.id]);
  const days = useMemo(() => new Map(notes.filter((n) => n.type === DAILY).map((n) => [n.title, n])), [notes]);
  const writtenParts = useMemo(() => new Set(notes.filter((n) => n.type !== DAILY).map((n) => `${n.type}|${n.title}`)), [notes]);

  if (current) return <Navigate to={periodHref(current)} replace />;
  if (!kind) return <div className="text-muted-foreground p-6 text-sm">“{raw}” is not a week, month, quarter or year.</div>;
  const up = parentOf(key);
  const finer = partsOf(key);
  const finerKind = finer[0] ? kindOfKey(finer[0]) : undefined;
  const showDays = kind === "week" || kind === "month";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PhoneDock>
        <div className="flex min-w-0 items-center gap-2 border-b px-4 py-1.5 max-md:contents">
          <Button size="icon" variant="ghost" className="size-7" onClick={() => navigate(periodHref(shiftPeriod(key, -1)))} aria-label={`Previous ${PERIOD_LABELS[kind].one.toLowerCase()}`}>
            <ChevronLeft />
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={() => navigate(periodHref(shiftPeriod(key, 1)))} aria-label={`Next ${PERIOD_LABELS[kind].one.toLowerCase()}`}>
            <ChevronRight />
          </Button>
          <Button variant={isCurrent ? "secondary" : "outline"} className="h-7" onClick={() => navigate(periodHref(periodKey(kind, today)))}>
            {PERIOD_LABELS[kind].this}
          </Button>
          {up && (
            <Button variant="ghost" className="h-7" onClick={() => navigate(periodHref(up))}>
              <ChevronUp /> {periodLabel(up)}
            </Button>
          )}
          <span className="min-w-0 truncate text-sm font-medium max-md:hidden">{periodLabel(key)}</span>
          {doc && (
            <div className="ml-auto max-md:contents">
              <JournalLinksButton docId={doc.id} index={index} />
            </div>
          )}
        </div>
      </PhoneDock>
      <div className="flex min-h-0 flex-1">
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {doc ? (
          <div className="flex min-h-[50vh] flex-col">
            <DocumentEditor key={doc.id} doc={doc} def={documentType(kind)} index={index} linksPanel={false} onDeleted={() => navigate(periodHref(key))} />
          </div>
        ) : (
          <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-12 text-sm">
            <div>
              No review of <span className="text-foreground font-medium">{periodLabel(key)}</span> yet.
            </div>
            <Button onClick={() => void ensurePeriod(key)}>
              <PenLine /> Start the review
            </Button>
          </div>
        )}
        <div className="mx-auto grid w-full max-w-3xl gap-3 p-4">
          {finer.length > 0 && finerKind && (
            <section className="grid gap-1.5">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{PERIOD_LABELS[finerKind].many}</h2>
              <div className="flex flex-wrap gap-1.5">
                {finer.map((p) => (
                  <Link key={p} to={periodHref(p)} className="hover:bg-accent flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs">
                    {periodLabel(p)}
                    {writtenParts.has(`${finerKind}|${p}`) && <span className="bg-primary size-1.5 rounded-full" title="Written" />}
                  </Link>
                ))}
              </div>
            </section>
          )}
          {showDays && (
            <section className="grid gap-1.5">
              <h2 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Days</h2>
              {daysOf(key)
                .filter((d) => d <= today)
                .map((d) => (
                  <DayRow key={d} date={d} day={days.get(d)} />
                ))}
            </section>
          )}
        </div>
      </div>
      {doc && <PeriodAside docId={doc.id} />}
      </div>
    </div>
  );
}
