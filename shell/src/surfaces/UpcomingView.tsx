import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button, cn } from "@lifeline/ui";
import {
  addDays,
  formatHuman,
  formatTime,
  parts,
  pieceLead,
  startOfWeek,
  upcomingRuns,
  useSurfaceItems,
  useTimedItems,
  type DateStr,
  type SurfaceItem,
  type SurfaceTimedItem,
} from "@lifeline/core";
import { Check, ChevronUp } from "lucide-react";
import { ItemMark, missed } from "./marks";
import { HoursEditor, type HoursEditing } from "./HoursEditor";
import { completeWork, useMoveDialog, WorkMenu, type DayWork } from "./WorkMenu";
import type { CalendarCtx } from "./CalendarSurface";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** How far ahead Upcoming reads at first, and how much more each time the end comes into view. */
const AHEAD_DAYS = 42;
const MORE_DAYS = 28;
/** How far back "Earlier" reaches each time. */
const EARLIER_DAYS = 14;

const weekday = (d: DateStr) => WEEKDAYS[(new Date(d + "T12:00:00").getDay() + 6) % 7];
const shortDay = (d: DateStr) => `${weekday(d)} ${parts(d).day}`;

/** One day's rows, in Upcoming's order (CONTEXT.md — Upcoming). */
interface DayRows {
  allDay: SurfaceTimedItem[];
  /** Timed items and Time blocks together, by start: blocked work is that day's work at its block's time. */
  atTimes: ({ kind: "timed"; item: SurfaceTimedItem; start: string } | { kind: "block"; item: SurfaceItem; start: string })[];
  work: DayWork[];
}

function rowsFor(d: DateStr, items: SurfaceItem[], timed: SurfaceTimedItem[]): DayRows {
  const onDay = timed.filter((t) => t.date === d);
  // All-day items first, markers (a Deadline) after them.
  const allDay = onDay.filter((t) => !t.start).sort((a, b) => Number(!!a.marker) - Number(!!b.marker));
  const blocks = items.filter((i) => i.displayDate === d && i.start);
  // As the Today feed: an item's own row is left out where a block already says it.
  const blocked = new Set(blocks.map((b) => b.key));
  const atTimes = [
    ...onDay.filter((t) => t.start).map((t) => ({ kind: "timed" as const, item: t, start: t.start! })),
    ...blocks.map((b) => ({ kind: "block" as const, item: b, start: b.start! })),
  ].sort((a, b) => a.start.localeCompare(b.start));
  const work = items.filter((i) => i.displayDate === d && !i.start && !blocked.has(i.key)) as DayWork[];
  return { allDay, atTimes, work };
}

function Tick({ item }: { item: DayWork }) {
  const done = !!item.completedOn;
  return (
    <button
      className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors", done ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")}
      disabled={done}
      aria-label={done ? "Done" : `Complete ${item.title}`}
      onClick={(e) => {
        e.stopPropagation();
        completeWork(item);
      }}
    >
      {done && <Check className="size-3" />}
    </button>
  );
}

/**
 * One row: its lead (a time, "All day"), a tick for work, and the rest a button
 * that opens the row's actions. The tick is beside the button, never inside it.
 */
function Row({ color, lead, tick, menu, children, onOpen, faded, late }: { color?: string; lead: React.ReactNode; tick?: React.ReactNode; menu?: React.ReactNode; children: React.ReactNode; onOpen: (el: HTMLElement) => void; faded?: boolean; late?: boolean }) {
  const c = color ?? "var(--muted-foreground)";
  // The editor's popover sits beside what it is anchored to: the narrow lead, so the row's width is free for it.
  const anchor = useRef<HTMLSpanElement>(null);
  return (
    <div
      className={cn("hover:bg-accent/60 relative flex min-h-9 cursor-pointer items-center gap-2 rounded-md border-l-[3px] px-2 text-sm", faded && "opacity-60", late && "text-destructive")}
      style={{ borderLeftColor: c, background: `color-mix(in oklab, ${c} 10%, transparent)` }}
      onClick={() => onOpen(anchor.current!)}
    >
      <span ref={anchor} className="text-muted-foreground w-16 shrink-0 py-1.5 text-xs tabular-nums">{lead}</span>
      {tick}
      <button className="flex min-w-0 flex-1 items-center gap-2 self-stretch py-1.5 text-left" onClick={(e) => {
        e.stopPropagation();
        onOpen(anchor.current!);
      }}>
        {children}
      </button>
      {menu}
    </div>
  );
}

/**
 * Upcoming (ADR 0063): the Calendar's list view, Google's "Schedule" view
 * under a name that does not clash with Lifeline's Schedule. It runs down the
 * days from the day in view: all-day items and markers, then timed items and
 * blocked work by start, then the day's work, tickable in place. Each day
 * reads as the Today feed reads today, so work blocked on a day is listed
 * there at its block's time, pointing on to its own day. Empty days fold into
 * one line, today and the day in view aside. Day-granular: no hours, no bands.
 *
 * It only reads and ticks — no drag, nothing added on a tap. A row opens its
 * actions: a work item's menu, or the hours' editor for an Event or a block.
 */
export function UpcomingView({ ctx }: { ctx: CalendarCtx }) {
  const { anchor, today, tags, openDay } = ctx;
  const [from, setFrom] = useState(anchor);
  const [to, setTo] = useState(addDays(anchor, AHEAD_DAYS));
  // A new day in view (Today, the date picker) starts the list over from it.
  useEffect(() => {
    setFrom(anchor);
    setTo(addDays(anchor, AHEAD_DAYS));
  }, [anchor]);

  const items = useSurfaceItems({ start: from, end: to }, { tags });
  // Time blockers are bands on the hour-scaled Schedule, not things on a day (ADR 0027).
  const timed = useTimedItems({ start: from, end: to }, { tags }).filter((t) => !t.background);
  const byDay = new Map<DateStr, DayRows>();
  const rows = (d: DateStr) => {
    let r = byDay.get(d);
    if (!r) byDay.set(d, (r = rowsFor(d, items, timed)));
    return r;
  };
  const busy = (d: DateStr) => {
    const r = rows(d);
    return r.allDay.length + r.atTimes.length + r.work.length > 0;
  };
  const runs = upcomingRuns(from, to, busy, [today, anchor]);

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<(HoursEditing & { id: number }) | null>(null);
  const move = useMoveDialog(today);
  const edit = (target: HoursEditing["target"], el: HTMLElement) => setEditing({ target, anchor: el, id: Date.now() });

  // The end of the list reads further ahead as it comes into view.
  const scroller = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = end.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es.some((e) => e.isIntersecting) && setTo((t) => addDays(t, MORE_DAYS)), { root: scroller.current, rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Reaching back adds days above: keep what was on screen where it was.
  const keepFrom = useRef<number | null>(null);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && keepFrom.current !== null) {
      el.scrollTop += el.scrollHeight - keepFrom.current;
      keepFrom.current = null;
    }
  }, [from]);

  let lastMonth = "";
  let lastWeek = "";

  return (
    <div className="flex h-full flex-col gap-3 p-4 max-md:gap-2 max-md:p-3">
      {ctx.header()}
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-3xl flex-col pb-8">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground self-center"
            onClick={() => {
              keepFrom.current = scroller.current?.scrollHeight ?? null;
              setFrom((f) => addDays(f, -EARLIER_DAYS));
            }}
          >
            <ChevronUp /> Earlier
          </Button>
          {runs.map((run) => {
            const first = run.kind === "day" ? run.date : run.from;
            const { y, m } = parts(first);
            const month = `${y}-${m}`;
            const week = startOfWeek(first);
            const monthHeading = month !== lastMonth;
            const weekHeading = !monthHeading && week !== lastWeek && first === week;
            lastMonth = month;
            lastWeek = week;
            const headings = (
              <>
                {monthHeading && <h2 className="bg-background sticky top-0 z-10 px-1 pt-4 pb-1 text-base font-semibold">{`${MONTHS[m - 1]} ${y}`}</h2>}
                {weekHeading && <div className="text-muted-foreground border-t px-1 pt-2 pb-1 text-xs">{`${formatHuman(week)} – ${formatHuman(addDays(week, 6))}`}</div>}
              </>
            );
            if (run.kind === "empty") {
              const one = run.from === run.to;
              return (
                <Fragment key={`empty:${run.from}`}>
                  {headings}
                  <div className={cn("text-muted-foreground px-1 py-1.5 text-xs", run.to < today && "opacity-60")}>
                    {one ? shortDay(run.from) : `${shortDay(run.from)} – ${shortDay(run.to)}`} · nothing on
                  </div>
                </Fragment>
              );
            }
            const d = run.date;
            const r = rows(d);
            const past = d < today;
            return (
              <Fragment key={d}>
                {headings}
                <section className={cn("flex gap-3 py-2", past && "opacity-70")} aria-label={formatHuman(d)}>
                  <button
                    className="hover:bg-accent flex w-11 shrink-0 flex-col items-center self-start rounded-md py-0.5"
                    title={`Open ${formatHuman(d)}`}
                    onClick={() => openDay(d)}
                  >
                    <span className={cn("text-[11px] uppercase", d === today ? "text-primary font-semibold" : "text-muted-foreground")}>{weekday(d)}</span>
                    <span className={cn("flex size-8 items-center justify-center rounded-full text-lg leading-none tabular-nums", d === today && "bg-primary text-primary-foreground font-semibold")}>
                      {parts(d).day}
                    </span>
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                    {!busy(d) && <div className="text-muted-foreground py-2 text-sm">Nothing on</div>}
                    {r.allDay.map((t) => (
                      <Row key={t.key} color={t.color} lead={t.marker ? "Deadline" : "All day"} late={missed(t)} onOpen={(el) => edit({ kind: "timed", item: t }, el)}>
                        <span className="truncate font-medium">{t.title}</span>
                      </Row>
                    ))}
                    {r.atTimes.map((e) =>
                      e.kind === "timed" ? (
                        <Row key={e.item.key} color={e.item.color} lead={pieceLead(e.item) ?? `${formatTime(e.start)}${e.item.end ? `–${formatTime(e.item.end)}` : ""}`} late={missed(e.item)} onOpen={(el) => edit({ kind: "timed", item: e.item }, el)}>
                          <span className="truncate font-medium">{e.item.title}</span>
                        </Row>
                      ) : (
                        <Row key={`${e.item.key}#${e.item.placementId}`} color={e.item.color} lead={formatTime(e.start)} faded={!!e.item.completedOn} tick={<Tick item={e.item as DayWork} />} onOpen={(el) => edit({ kind: "work", item: e.item }, el)}>
                          <span className={cn("truncate", e.item.completedOn && "line-through")}>
                            <ItemMark mark={e.item.mark} />
                            {e.item.title}
                          </span>
                          {/* The block is planning, never the item: its own day stays where it is (ADR 0028). */}
                          {e.item.date && e.item.date !== d && <span className="text-muted-foreground ml-auto shrink-0 text-xs">→ {shortDay(e.item.date)}</span>}
                        </Row>
                      ),
                    )}
                    {r.work.map((w) => (
                      <Row
                        key={w.key}
                        color={w.color}
                        lead=""
                        faded={!!w.completedOn}
                        late={w.urgency === "overdue" && !w.completedOn}
                        tick={<Tick item={w} />}
                        menu={<WorkMenu item={w} open={menuFor === w.key} onOpenChange={(o) => setMenuFor(o ? w.key : null)} onMove={move.start} />}
                        onOpen={() => setMenuFor(w.key)}
                      >
                        <span className={cn("truncate", w.completedOn && "line-through")}>
                          <ItemMark mark={w.mark} />
                          {w.title}
                        </span>
                        {(w.blocksAhead ?? 0) > 0 && <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">×{w.blocksAhead} planned</span>}
                      </Row>
                    ))}
                  </div>
                </section>
              </Fragment>
            );
          })}
          {/* Read on as it comes into view; a tap where a long free stretch leaves it in view already. */}
          <div ref={end} className="self-center py-2">
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setTo((t) => addDays(t, MORE_DAYS))}>
              Through {formatHuman(to)} · show more
            </Button>
          </div>
        </div>
      </div>

      {move.dialog}
      {editing && (
        <HoursEditor
          key={editing.id}
          editing={editing}
          defaultDay={anchor}
          inView={(d) => d >= from && d <= to}
          onGo={(d) => openDay(d)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
