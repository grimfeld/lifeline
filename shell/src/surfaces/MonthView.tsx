import { useRef, useState } from "react";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { cn, toast } from "@lifeline/ui";
import {
  addDays,
  appById,
  canMoveTimed,
  formatHuman,
  formatTime,
  fromParts,
  daysInMonth,
  moveTimedItem,
  parts,
  usePoolItems,
  useSurfaceItems,
  useTimedItems,
  type DateStr,
  type SurfaceTimedItem,
} from "@lifeline/core";
import { ChevronDown, Inbox, Pin } from "lucide-react";
import { ItemMark, missed } from "./marks";
import { HoursEditor, type HoursEditing } from "./HoursEditor";
import { moveWork, useMoveDialog, WorkMenu, type DayWork } from "./WorkMenu";
import type { CalendarCtx } from "./CalendarSurface";

const POOL = "pool";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** As on the Schedule: long enough that a flick to scroll (or to page the month) never lifts a chip. */
const LONG_PRESS_MS = 350;

/** A drag ends with a click on whatever it was released over: that click is not a tap. */
function useDragGuard() {
  const last = useRef(0);
  return { mark: () => (last.current = Date.now()), recent: () => Date.now() - last.current < 350 };
}

/** An Event (or other Timed item) on its day: opens in the hours' editor, drags to another day where its App allows. */
function TimedChip({ item, onOpen }: { item: SurfaceTimedItem; onOpen: (el: HTMLElement) => void }) {
  const movable = canMoveTimed(item.appId);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `timed:${item.key}`, data: { timed: item }, disabled: !movable });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("hover:bg-accent flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-xs", movable && "cursor-grab", isDragging && "opacity-40", missed(item) && "text-destructive font-medium")}
      title={`${appById(item.appId)?.title} · ${item.subtitle ?? item.title}`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen(e.currentTarget);
      }}
    >
      <span className="size-1.5 shrink-0 rounded-sm" style={{ background: item.color ?? "var(--muted-foreground)" }} />
      {item.start && <span className="text-muted-foreground shrink-0">{formatTime(item.start)}</span>}
      <span className="truncate">{item.title}</span>
    </div>
  );
}

/** A work item: tap for its menu, drag (long press on a phone) to Move it. */
function WorkChip({ item, onTap, menu }: { item: DayWork; onTap: () => void; menu: React.ReactNode }) {
  const done = !!item.completedOn;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${item.key}`, data: { item }, disabled: done });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        "hover:bg-accent relative flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs transition-colors",
        !done && "cursor-grab",
        isDragging && "opacity-40",
        done && "text-muted-foreground line-through",
        item.urgency === "overdue" && !done && "text-destructive",
      )}
      onClick={(e) => {
        // The day cell opens the day; a chip's own tap belongs to its menu.
        e.stopPropagation();
        onTap();
      }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: item.color ?? "var(--muted-foreground)" }} />
      <span className="truncate">
        <ItemMark mark={item.mark} />
        {item.title}
      </span>
      {item.placementId && <Pin className="text-muted-foreground ml-auto size-3 shrink-0" />}
      {menu}
    </div>
  );
}

function DayCell({ date, inMonth, today, children, onOpen }: { date: DateStr; inMonth: boolean; today: DateStr; children: React.ReactNode; onOpen: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${date}` });
  return (
    <div
      ref={setNodeRef}
      onClick={onOpen}
      className={cn("bg-background flex min-h-0 cursor-pointer flex-col gap-0.5 p-1 max-md:p-0.5", !inMonth && "bg-muted/40 text-muted-foreground", isOver && "bg-accent/50")}
    >
      <button
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
        title={`Open ${formatHuman(date)}`}
        className={cn("mb-0.5 self-start rounded-full px-1.5 text-xs leading-5", date === today ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent")}
      >
        {parts(date).day}
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/** The Unplaced pool beside the month: a column at the desk, a drawer on a phone. Overdue work from before the grid rides in it. */
function Pool({ items, overdue, collapsible, chip }: { items: DayWork[]; overdue: DayWork[]; collapsible: boolean; chip: (item: DayWork) => React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL });
  const [open, setOpen] = useState(false);
  const body = (
    <>
      {overdue.length > 0 && (
        <>
          <div className="text-destructive px-0.5 text-xs font-medium">Overdue ({overdue.length})</div>
          {overdue.map(chip)}
          <div className="bg-border my-1 h-px" />
        </>
      )}
      {items.map(chip)}
      {items.length === 0 && overdue.length === 0 && <div className="text-muted-foreground p-2 text-xs">Nothing unplaced.</div>}
    </>
  );
  if (collapsible) {
    return (
      <div ref={setNodeRef} className={cn("shrink-0 rounded-lg border", isOver && "bg-accent/40")}>
        <button className="text-muted-foreground flex w-full items-center gap-1 px-2 py-1.5 text-xs font-medium" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Inbox className="size-3.5" /> Unplaced <span className="tabular-nums">{items.length}</span>
          {overdue.length > 0 && <span className="text-destructive tabular-nums">· {overdue.length} overdue</span>}
          <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {open && <div className="max-h-48 space-y-0.5 overflow-y-auto border-t p-1">{body}</div>}
      </div>
    );
  }
  return (
    <div ref={setNodeRef} className={cn("flex min-h-0 flex-col rounded-lg border", isOver && "bg-accent/40")}>
      <div className="text-muted-foreground flex items-center gap-1 border-b px-2 py-1.5 text-xs font-medium">
        <Inbox className="size-3.5" /> Unplaced <span className="ml-auto">{items.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-1">{body}</div>
    </div>
  );
}

/**
 * Month (ADR 0063): the Calendar's six-week grid, day-granular — each item on
 * its own day only, no Time blocker bands. It takes Moves by drag: a chip to
 * another day, the pool's onto a day, a day's back to the pool (where its App
 * owns moves). Tapping a day opens it in Day view.
 */
export function MonthView({ ctx }: { ctx: CalendarCtx }) {
  const { anchor, today, days, tags, isMobile, openDay } = ctx;
  const { y, m } = parts(anchor);
  const monthStart = fromParts(y, m, 1);
  const monthEnd = fromParts(y, m, daysInMonth(y, m));
  const gridStart = days[0];
  const gridEnd = days[days.length - 1];

  // Day-granular: the item on its own day only — its Time blocks are Schedule detail (ADR 0028).
  // Looking back lets work missed before the grid surface in the pool as Overdue.
  const items = useSurfaceItems({ start: addDays(gridStart, -90), end: gridEnd }, { tags }).filter((i) => !i.start) as DayWork[];
  const pool = usePoolItems({ tags }) as DayWork[];
  // Time blockers are bands on the hour-scaled Schedule, not things on a day (ADR 0027).
  const timed = useTimedItems({ start: gridStart, end: gridEnd }, { tags }).filter((t) => !t.background);
  // Only what the owning App still calls overdue: a lapsed Occurrence (ADR 0036) keeps its own day.
  const overdue = items.filter((i) => i.displayDate! < gridStart && !i.completedOn && i.urgency === "overdue");
  const inGrid = items.filter((i) => i.displayDate! >= gridStart);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 } }),
  );
  const [active, setActive] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [editing, setEditing] = useState<(HoursEditing & { id: number }) | null>(null);
  const drag = useDragGuard();
  const move = useMoveDialog(today);

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    drag.mark();
    if (!e.over) return;
    const overId = String(e.over.id);
    const to = overId === POOL ? null : overId.startsWith("day:") ? overId.slice(4) : undefined;
    if (to === undefined) return;
    const d = e.active.data.current as { item?: DayWork; timed?: SurfaceTimedItem };
    if (d.timed) {
      if (to === null || to === d.timed.date) return;
      moveTimedItem(d.timed, to)
        .then(() => toast.success(`Moved to ${formatHuman(to)}`))
        .catch((err: Error) => toast.error(err.message));
    } else if (d.item) {
      moveWork(d.item, to);
    }
  }

  const chip = (item: DayWork) => (
    <WorkChip
      key={item.key}
      item={item}
      onTap={() => !drag.recent() && setMenuFor(item.key)}
      menu={<WorkMenu item={item} open={menuFor === item.key} onOpenChange={(o) => setMenuFor(o ? item.key : null)} onMove={move.start} />}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={(e) => {
        const d = e.active.data.current as { item?: DayWork; timed?: SurfaceTimedItem };
        setActive(d.item?.title ?? d.timed?.title ?? null);
        if ("touches" in e.activatorEvent) navigator.vibrate?.(10);
      }}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActive(null);
        drag.mark();
      }}
    >
      <div className="flex h-full flex-col gap-3 p-4 max-md:gap-2 max-md:p-3">
        {ctx.header()}
        <div className="grid min-h-0 flex-1 grid-cols-[13rem_1fr] gap-2 max-md:flex max-md:flex-col">
          <Pool items={pool} overdue={overdue} collapsible={isMobile} chip={chip} />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
            <div className="text-muted-foreground grid grid-cols-7 gap-px text-center text-xs font-medium">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="bg-border grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-lg border">
              {days.map((d) => (
                <DayCell key={d} date={d} inMonth={d >= monthStart && d <= monthEnd} today={today} onOpen={() => !drag.recent() && openDay(d)}>
                  {timed
                    .filter((t) => t.date === d)
                    .map((t) => (
                      <TimedChip key={t.key} item={t} onOpen={(el) => !drag.recent() && setEditing({ target: { kind: "timed", item: t }, anchor: el, id: Date.now() })} />
                    ))}
                  {inGrid.filter((i) => i.displayDate === d).map(chip)}
                </DayCell>
              ))}
            </div>
          </div>
        </div>
        <p className="text-muted-foreground shrink-0 text-[11px]">
          {isMobile
            ? "Tap a day to open it · tap an item for its actions · press and hold to drag it to another day."
            : "Click a day to open it · click an item for its actions · drag an item to another day, or from Unplaced onto one."}
        </p>
      </div>

      <DragOverlay dropAnimation={null}>{active && <div className="bg-card rounded-md border px-2 py-1 text-xs shadow-md">{active}</div>}</DragOverlay>
      {move.dialog}
      {editing && (
        <HoursEditor
          key={editing.id}
          editing={editing}
          defaultDay={anchor}
          inView={(d) => d >= gridStart && d <= gridEnd}
          onGo={(d) => ctx.go(d)}
          onClose={() => setEditing(null)}
        />
      )}
    </DndContext>
  );
}

