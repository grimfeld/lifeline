import { useState } from "react";
import { addDays, todayStr, type DateStr } from "@lifeline/core";
import { Button, Tip, cn } from "@lifeline/ui";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { YEARS_PER_PAGE, writtenMonths, writtenYears, yearsPage, yearsPageEnd } from "../domain/calendarZoom";
import { periodKey, periodLabel, shiftPeriod } from "../domain/periods";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

/**
 * What the calendar shows, apart from the open Day: a level and the stretch at
 * that level, as a period key. "days" shows a month's days (key `YYYY-MM`),
 * "months" a year's months (`YYYY`), "years" a page of the years list (key: the
 * page's last year, `YYYY` — see `yearsPageEnd`).
 */
type CalendarLevel = "days" | "months" | "years";
interface CalendarView {
  level: CalendarLevel;
  key: string;
}

/** The view around a date: its month's days. */
const viewAt = (date: DateStr): CalendarView => ({ level: "days", key: periodKey("month", date) });

/** One arrow: its name, icon and how far it moves the shown stretch (in steps of the key's own period). */
interface Arrow {
  label: string;
  icon: typeof ChevronLeft;
  by: number;
}

/** Per level: the arrows either side of the title, outermost first. Each pages by its level: months, years, a page of years. */
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
  months: {
    before: [{ label: "Previous year", icon: ChevronLeft, by: -1 }],
    after: [{ label: "Next year", icon: ChevronRight, by: 1 }],
  },
  years: {
    before: [{ label: "Earlier years", icon: ChevronLeft, by: -YEARS_PER_PAGE }],
    after: [{ label: "Later years", icon: ChevronRight, by: YEARS_PER_PAGE }],
  },
};

/**
 * The Journal sidebar's calendar. It pages by itself: its arrows change only
 * what it shows, never the open Day or the URL, and it comes back to the open
 * Day's month whenever that Day changes. Its title zooms out — a month's to
 * its year's months, a year's to the list of years — and picking a month or a
 * year zooms back in; picking a day opens it. It shows `date`'s month; `open`
 * is the Day open beside it, marked — none on a period's page.
 */
export function JournalCalendar({ date, open, written, onPick }: { date: DateStr; open?: DateStr; written: Set<string>; onPick: (d: DateStr) => void }) {
  const [view, setView] = useState(() => viewAt(date));
  // Snap back to the open Day whenever it changes, by whatever means.
  const [shownFor, setShownFor] = useState(date);
  if (shownFor !== date) {
    setShownFor(date);
    setView(viewAt(date));
  }
  const thisYear = Number(todayStr().slice(0, 4));
  const page = view.level === "years" ? yearsPage(Number(view.key), written, thisYear) : undefined;

  const arrow = (a: Arrow) => (
    <Tip key={a.label} label={a.label}>
      <Button
        size="icon-xs"
        variant="ghost"
        className="shrink-0"
        // The years list ends at the earliest written year and at this year.
        disabled={page && (a.by < 0 ? !page.earlier : !page.later)}
        onClick={() => setView((v) => ({ ...v, key: shiftPeriod(v.key, a.by) }))}
      >
        <a.icon />
      </Button>
    </Tip>
  );

  // The title zooms out one level; the years list is as far out as it goes.
  const zoomOut: CalendarView | undefined =
    view.level === "days"
      ? { level: "months", key: view.key.slice(0, 4) }
      : view.level === "months"
        ? { level: "years", key: String(yearsPageEnd(Number(view.key), written, thisYear)) }
        : undefined;
  const title = page ? `${page.years[0]}–${page.years.at(-1)}` : periodLabel(view.key);

  return (
    <div role="group" aria-label="Calendar" className="grid gap-1">
      <div className="flex min-w-0 items-center gap-0.5">
        {ARROWS[view.level].before.map(arrow)}
        {zoomOut ? (
          <Button size="xs" variant="ghost" className="min-w-0 flex-1" onClick={() => setView(zoomOut)}>
            <span className="truncate">{title}</span>
          </Button>
        ) : (
          <span className="min-w-0 flex-1 truncate text-center text-xs font-medium">{title}</span>
        )}
        {ARROWS[view.level].after.map(arrow)}
      </div>
      {view.level === "days" && <MonthDays month={view.key} open={open} written={written} onPick={onPick} />}
      {view.level === "months" && <YearMonths year={view.key} open={open} written={written} onPick={(key) => setView({ level: "days", key })} />}
      {page && <YearsList years={page.years} open={open} written={written} onPick={(key) => setView({ level: "months", key })} />}
    </div>
  );
}

/** A month's days as a grid: written days dotted, today ringed, the open Day filled. */
function MonthDays({ month, open, written, onPick }: { month: string; open?: DateStr; written: Set<string>; onPick: (d: DateStr) => void }) {
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
            <Tile
              key={d}
              name={d}
              label={String(Number(d.slice(-2)))}
              className="aspect-square"
              open={d === open}
              now={d === today}
              later={d > today}
              written={written.has(d)}
              onClick={() => onPick(d)}
            />
          ) : (
            <span key={`x${i}`} />
          ),
        )}
      </div>
    </>
  );
}

/**
 * One tile of the calendar, a day, a month or a year: dotted when written,
 * filled when it is or holds the open Day, ringed when it holds today. Named
 * by its key (`2001-02-14`, `2001-02`, `2001`), ", written" after it when written.
 */
function Tile(props: { name: string; label: string; className: string; open: boolean; now: boolean; later: boolean; written: boolean; onClick: () => void }) {
  const { name, label, className, open, now, later, written, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={written ? `${name}, written` : name}
      aria-current={open ? "date" : undefined}
      className={cn(
        "focus-visible:ring-ring relative rounded text-xs tabular-nums outline-none focus-visible:ring-2",
        className,
        open ? "bg-primary text-primary-foreground" : "hover:bg-accent",
        now && !open && "ring-primary ring-1",
        later && "opacity-40",
      )}
    >
      {label}
      {written && !open && <span className="bg-primary absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full" />}
    </button>
  );
}

/** A month's or a year's tile: wider than a day, so its label may need cutting short. */
const TILE = "truncate px-1 py-2";

/** A year's twelve months; picking one shows its days. */
function YearMonths({ year, open, written, onPick }: { year: string; open?: DateStr; written: Set<string>; onPick: (month: string) => void }) {
  const marked = writtenMonths(written);
  const now = todayStr().slice(0, 7);
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {Array.from({ length: 12 }, (_, i) => {
        const key = `${year}-${String(i + 1).padStart(2, "0")}`;
        const short = new Date(Date.UTC(Number(year), i, 1)).toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
        return (
          <Tile
            key={key}
            name={key}
            label={short}
            className={TILE}
            open={open?.slice(0, 7) === key}
            now={key === now}
            later={key > now}
            written={marked.has(key)}
            onClick={() => onPick(key)}
          />
        );
      })}
    </div>
  );
}

/** A page of the years list; picking a year shows its months. */
function YearsList({ years, open, written, onPick }: { years: number[]; open?: DateStr; written: Set<string>; onPick: (year: string) => void }) {
  const marked = writtenYears(written);
  const now = todayStr().slice(0, 4);
  return (
    <div className="grid grid-cols-3 gap-0.5">
      {years.map((n) => {
        const y = String(n);
        return <Tile key={y} name={y} label={y} className={TILE} open={open?.slice(0, 4) === y} now={y === now} later={false} written={marked.has(y)} onClick={() => onPick(y)} />;
      })}
    </div>
  );
}
