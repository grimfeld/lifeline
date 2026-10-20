import { useState } from "react";
import { Link } from "react-router";
import { addDays, formatHuman, todayStr, type DateStr } from "@lifeline/core";
import { Button, Tip, cn } from "@lifeline/ui";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { periodKey, periodLabel, shiftPeriod } from "../domain/periods";
import { periodHref } from "../domain/types";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * What the calendar shows, apart from the open Day: a level and the stretch at
 * that level, as a period key. Only "days" (a month, key `YYYY-MM`) for now;
 * zooming out adds "months" (a year, `YYYY`) and "years".
 */
type CalendarLevel = "days";
interface CalendarView {
  level: CalendarLevel;
  key: string;
}

/** The view around a date: its month's days. */
const viewAt = (date: DateStr): CalendarView => ({ level: "days", key: periodKey("month", date) });

/** One arrow: its name, icon and how far it moves the shown stretch (in steps of the level's own period). */
interface Arrow {
  label: string;
  icon: typeof ChevronLeft;
  by: number;
}

/** Per level: the arrows either side of the title, outermost first. */
const ARROWS: Record<CalendarLevel, { before: Arrow[]; after: Arrow[] }> = {
  days: {
    before: [
      { label: "Previous year", icon: ChevronsLeft, by: -12 },
      { label: "Previous month", icon: ChevronLeft, by: -1 },
    ],
    after: [
      { label: "Next month", icon: ChevronRight, by: 1 },
      { label: "Next year", icon: ChevronsRight, by: 12 },
    ],
  },
};

/**
 * The Journal sidebar's calendar. It pages by itself: its arrows change only
 * what it shows, never the open Day or the URL, and it comes back to the open
 * Day's month whenever that Day changes. Picking a day opens it.
 */
export function JournalCalendar({ date, written, onPick }: { date: DateStr; written: Set<string>; onPick: (d: DateStr) => void }) {
  const [view, setView] = useState(() => viewAt(date));
  // Snap back to the open Day whenever it changes, by whatever means.
  const [shownFor, setShownFor] = useState(date);
  if (shownFor !== date) {
    setShownFor(date);
    setView(viewAt(date));
  }

  const arrow = (a: Arrow) => (
    <Tip key={a.label} label={a.label}>
      <Button size="icon-xs" variant="ghost" className="shrink-0" onClick={() => setView((v) => ({ ...v, key: shiftPeriod(v.key, a.by) }))}>
        <a.icon />
      </Button>
    </Tip>
  );

  return (
    <div role="group" aria-label="Calendar" className="grid gap-1">
      <div className="flex min-w-0 items-center gap-0.5">
        {ARROWS[view.level].before.map(arrow)}
        <Link to={periodHref(view.key)} className="min-w-0 flex-1 truncate text-center text-xs font-medium hover:underline">
          {periodLabel(view.key)}
        </Link>
        {ARROWS[view.level].after.map(arrow)}
      </div>
      <MonthDays month={view.key} open={date} written={written} onPick={onPick} />
    </div>
  );
}

/** A month's days as a grid: written days dotted, today ringed, the open Day filled. */
function MonthDays({ month, open, written, onPick }: { month: string; open: DateStr; written: Set<string>; onPick: (d: DateStr) => void }) {
  const first = `${month}-01`;
  const lead = (new Date(`${first}T00:00:00`).getDay() + 6) % 7;
  const cells: (DateStr | null)[] = Array.from({ length: lead }, () => null);
  for (let d = first; d.slice(0, 7) === month; d = addDays(d, 1)) cells.push(d);
  const today = todayStr();
  return (
    <>
      <div className="text-muted-foreground text-2xs grid grid-cols-7 text-center">
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
              title={written.has(d) ? `${formatHuman(d)} · written` : formatHuman(d)}
              aria-label={d}
              aria-current={d === open ? "date" : undefined}
              className={cn(
                "focus-visible:ring-ring relative aspect-square rounded text-xs tabular-nums outline-none focus-visible:ring-2",
                d === open ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                d === today && d !== open && "ring-primary ring-1",
                d > today && "opacity-40",
              )}
            >
              {Number(d.slice(-2))}
              {written.has(d) && d !== open && <span className="bg-primary absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full" />}
            </button>
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
    </>
  );
}
