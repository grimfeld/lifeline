import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  Input,
  PhoneDock,
} from "@lifeline/ui";
import {
  CALENDAR_VIEWS,
  composeTagFilter,
  formatHuman,
  isCalendarView,
  parts,
  stepView,
  todayStr,
  useIsMobile,
  useSurfaceScope,
  viewDays,
  type CalendarView,
  type DateStr,
  type TagFilter,
} from "@lifeline/core";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { TagFilterBar } from "../components/TagFilterBar";
import { TimeAppLinks } from "./TimeAppLinks";
import { ScheduleView } from "./ScheduleView";
import { MonthView } from "./MonthView";
import { UpcomingView } from "./UpcomingView";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** A swipe pages the view; anything slower is a long-press drag or a scroll (ADR 0021). */
const SWIPE_MS = 350;
const SWIPE_PX = 60;

/** What every view of the Calendar is handed: the day in view and how to move it. */
export interface CalendarCtx {
  view: CalendarView;
  /** The day in view (ADR 0063): kept across views, carried in `?d=`. */
  anchor: DateStr;
  today: DateStr;
  /** The days this view shows for the day in view. */
  days: DateStr[];
  tags: TagFilter;
  isMobile: boolean;
  /** Move the day in view, and the view with it when one is named. */
  go: (d: DateStr, view?: CalendarView) => void;
  /** Open one day: in Day view where this Calendar offers it, else Upcoming from that day. */
  openDay: (d: DateStr) => void;
  /**
   * The Calendar's header, with whatever the view adds to its controls, and a
   * row of its own beneath them. In the phone dock on a phone.
   */
  header: (extra?: ReactNode, below?: ReactNode) => ReactNode;
}

const rememberKey = (place: string) => `lifeline:calendar-view:${place}`;

function remembered(place: string): CalendarView | null {
  try {
    const v = localStorage.getItem(rememberKey(place));
    return isCalendarView(v) ? v : null;
  } catch {
    return null;
  }
}

function remember(place: string, view: CalendarView) {
  try {
    localStorage.setItem(rememberKey(place), view);
  } catch {
    // Private mode or blocked storage: the Calendar just opens on its default next time.
  }
}

function label(view: CalendarView, days: DateStr[], anchor: DateStr): string {
  switch (view) {
    case "day":
      return formatHuman(anchor);
    case "3day":
    case "week":
      return `${formatHuman(days[0])} – ${formatHuman(days[days.length - 1])}`;
    case "month": {
      const { y, m } = parts(anchor);
      return `${MONTHS[m - 1]} ${y}`;
    }
    case "upcoming":
      return `From ${formatHuman(anchor)}`;
  }
}

/**
 * The **Calendar** (ADR 0063): the one Surface for time, its views switched in
 * place — Upcoming · Day · 3 Day · Week · Month. Day, 3 Day and Week are the
 * Schedule; Month and Upcoming are day-granular.
 *
 * The view and the day in view live in the URL, so a link opens exactly what
 * was seen. With no view named, the Calendar opens on the one it last showed
 * on this device — a memory the Calendar keeps per place, not the Phone bar
 * slot (which goes where it points): the general Calendar and a Module's lens
 * never change each other.
 *
 * Embedded in a Module it is that Module's lens: the Surface scope narrows
 * what the hooks return, and `views` narrows what it offers.
 */
export function CalendarSurface({ views = CALENDAR_VIEWS.map((v) => v.id) }: { views?: CalendarView[] }) {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const scope = useSurfaceScope();
  const place = scope?.moduleId ?? "general";
  const today = todayStr();

  const fallback: CalendarView = isMobile ? "upcoming" : "week";
  const asked = params.get("view");
  const view: CalendarView = [asked, remembered(place), fallback, views[0]].find(
    (v): v is CalendarView => isCalendarView(v) && views.includes(v),
  )!;
  const anchor: DateStr = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") ?? "") ? params.get("d")! : today;
  const days = viewDays(view, anchor);

  useEffect(() => remember(place, view), [place, view]);

  const go = (d: DateStr, v: CalendarView = view) => setParams({ view: v, ...(d === today ? {} : { d }) });
  const openDay = (d: DateStr) => go(d, views.includes("day") ? "day" : "upcoming");

  // The Tag filter holds across views, as the day does.
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const tags = composeTagFilter(tagFilter);

  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const pageable = view !== "upcoming";

  const header = (extra?: ReactNode, below?: ReactNode) => (
    // On a phone the header is the controls in the dock above the Phone bar,
    // under the thumb; on the desk it heads the view. Swipes never start in it:
    // its controls scroll sideways on their own.
    <PhoneDock className="flex flex-col gap-2 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2" data-no-swipe>
        {isMobile ? (
          // A phone has no width for five segments: the views are a menu under the title, as in Google's.
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-baseline gap-1.5 text-left" aria-label="Change view">
                <h1 className="text-xl font-semibold tracking-tight">{CALENDAR_VIEWS.find((v) => v.id === view)!.title}</h1>
                <span className="text-muted-foreground text-sm">{label(view, days, anchor)}</span>
                <ChevronDown className="text-muted-foreground size-4 self-center" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup value={view} onValueChange={(v) => isCalendarView(v) && go(anchor, v)}>
                {CALENDAR_VIEWS.filter((v) => views.includes(v.id)).map((v) => (
                  <DropdownMenuRadioItem key={v.id} value={v.id}>
                    {v.title}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <>
            <h1 className="text-xl font-semibold tracking-tight">Calendar</h1>
            <span className="text-muted-foreground text-sm">{label(view, days, anchor)}</span>
          </>
        )}
        <div className="ml-auto flex items-center gap-1">
          <TagFilterBar value={tagFilter} onChange={setTagFilter} className="mr-2" />
          <TimeAppLinks />
          {!isMobile && views.length > 1 && (
            <div className="bg-muted/60 mr-2 flex gap-0.5 rounded-lg p-0.5" role="tablist" aria-label="View">
              {CALENDAR_VIEWS.filter((v) => views.includes(v.id)).map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={view === v.id}
                  className={cn("rounded-md px-2 py-1 text-xs font-medium", view === v.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => go(anchor, v.id)}
                >
                  {v.title}
                </button>
              ))}
            </div>
          )}
          {pageable && (
            <Button size="icon" variant="outline" className="size-8" onClick={() => go(stepView(view, anchor, -1))} aria-label="Previous">
              <ChevronLeft />
            </Button>
          )}
          <Button variant="outline" className="h-8" onClick={() => go(today)}>
            Today
          </Button>
          {pageable && (
            <Button size="icon" variant="outline" className="size-8" onClick={() => go(stepView(view, anchor, 1))} aria-label="Next">
              <ChevronRight />
            </Button>
          )}
          <Input type="date" className="h-8 w-36 max-md:hidden" value={anchor} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Jump to date" />
          {extra}
        </div>
      </div>
      {below}
    </PhoneDock>
  );

  const ctx: CalendarCtx = { view, anchor, today, days, tags, isMobile, go, openDay, header };

  return (
    <div
      className="h-full"
      // A quick horizontal flick pages the view on a phone. A long-press drag
      // takes longer than SWIPE_MS before it moves, so it never reads as one.
      onTouchStart={(e) => {
        const t = e.touches[0];
        const inHeader = (e.target as HTMLElement).closest("[data-no-swipe]");
        swipe.current = isMobile && pageable && t && !inHeader ? { x: t.clientX, y: t.clientY, t: Date.now() } : null;
      }}
      onTouchEnd={(e) => {
        const s = swipe.current;
        swipe.current = null;
        const t = e.changedTouches[0];
        if (!s || !t || Date.now() - s.t > SWIPE_MS) return;
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < 1.5 * Math.abs(dy)) return;
        go(stepView(view, anchor, dx < 0 ? 1 : -1));
      }}
    >
      {view === "upcoming" ? <UpcomingView ctx={ctx} /> : view === "month" ? <MonthView ctx={ctx} /> : <ScheduleView ctx={ctx} />}
    </div>
  );
}

/** The general Calendar: every view, everything the Contracts reach. */
export function CalendarPage() {
  return <CalendarSurface />;
}
