import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { DndContext, DragOverlay, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Badge, Button, cn, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import {
  addDays,

  canRescheduleTimed,
  completeSurfaceItem,
  composeTagFilter,
  formatHuman,
  formatTime,
  hourWindow,
  layoutColumns,
  moveSurfaceItem,
  moveTimedItem,
  parts,
  rescheduleTimedItem,
  scheduleSurfaceItem,
  startOfWeek,
  timedCreators,
  todayStr,
  toHours,
  usePoolItems,
  useSurfaceItems,
  useTimedItems,
  type DateStr,
  type PoolItem,
  type SurfaceItem,
  type SurfaceTimedItem,
} from "@lifeline/core";
import { Check, ChevronLeft, ChevronRight, Inbox, Undo2 } from "lucide-react";
import { TagFilterBar } from "../components/TagFilterBar";

const HOUR_PX = 56;
const SNAP_MIN = 15;
const DEFAULT_MIN = 30;
const POOL = "pool";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type WorkItem = (SurfaceItem | (PoolItem & { displayDate?: undefined; placementId?: undefined; start?: undefined; end?: undefined })) & { color?: string };
type Entry = { kind: "block"; item: SurfaceItem; start: string; end: string } | { kind: "timed"; item: SurfaceTimedItem; start: string; end: string };

function toClock(hours: number): string {
  const h = Math.max(0, Math.min(24, hours));
  const total = Math.round(h * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function snap(hours: number): number {
  return Math.round((hours * 60) / SNAP_MIN) * (SNAP_MIN / 60);
}
function durationOf(start: string, end: string | null | undefined, fallbackMin = DEFAULT_MIN): number {
  return end ? Math.max(SNAP_MIN / 60, toHours(end) - toHours(start)) : fallbackMin / 60;
}
function addHours(start: string, h: number): string {
  return toClock(Math.min(24, toHours(start) + h));
}

/** A draggable chip: an untimed work item (strip or pool) or an all-day timed item. */
function Chip({ id, data, title, color, done, onComplete }: { id: string; data: Record<string, unknown>; title: string; color?: string; done?: boolean; onComplete?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} className={cn("bg-card flex cursor-grab items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs select-none", isDragging && "opacity-40", done && "opacity-60")} title={title}>
      {onComplete && !done && (
        <button
          className="hover:bg-accent flex size-4 shrink-0 items-center justify-center rounded-full border"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          aria-label="Complete"
        >
          <Check className="size-2.5" />
        </button>
      )}
      {done && <Check className="text-muted-foreground size-3 shrink-0" />}
      <span className={cn("truncate", done && "line-through")}>{title}</span>
      <span className="ml-auto size-1.5 shrink-0 rounded-full" style={{ background: color ?? "var(--muted-foreground)" }} />
    </div>
  );
}

/** A block on the timeline: draggable, resizable at the bottom edge. */
function Block({ entry, from, cols, col, onResize, onComplete, onUntime }: { entry: Entry; from: number; cols: number; col: number; onResize: (endHours: number) => void; onComplete?: () => void; onUntime?: () => void }) {
  const isBlock = entry.kind === "block";
  const id = isBlock ? `block:${entry.item.key}` : `timed:${entry.item.key}`;
  const grab = useRef(0);
  const data = isBlock ? { item: entry.item, grab } : { timed: entry.item, grab };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  const s = toHours(entry.start);
  const e = toHours(entry.end);
  const done = isBlock && !!entry.item.completedOn;
  const color = entry.item.color ?? "var(--muted-foreground)";
  const resizing = useRef<{ startY: number; startEnd: number } | null>(null);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("group absolute overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-xs shadow-sm select-none", isBlock ? "cursor-grab" : "cursor-grab", isDragging && "opacity-40", done && "opacity-60")}
      style={{
        top: (s - from) * HOUR_PX + 1,
        height: Math.max(18, (e - s) * HOUR_PX - 2),
        left: `calc(${(col / cols) * 100}% + 2px)`,
        width: `calc(${100 / cols}% - 4px)`,
        background: `color-mix(in oklab, ${color} ${isBlock ? "18%" : "28%"}, var(--card))`,
        borderLeftColor: color,
      }}
      title={`${formatTime(entry.start)}–${formatTime(entry.end)} ${entry.item.title}`}
      onPointerDownCapture={(ev) => {
        grab.current = ev.clientY - ev.currentTarget.getBoundingClientRect().top;
      }}
    >
      <div className="flex items-center gap-1">
        {isBlock && !done && onComplete && (
          <button
            className="hover:bg-accent flex size-3.5 shrink-0 items-center justify-center rounded-full border"
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => {
              ev.stopPropagation();
              onComplete();
            }}
            aria-label="Complete"
          >
            <Check className="size-2" />
          </button>
        )}
        {done && <Check className="size-3 shrink-0" />}
        <span className={cn("truncate font-medium", done && "line-through")}>{entry.item.title}</span>
        {isBlock && onUntime && (
          <button
            className="text-muted-foreground hover:text-foreground ml-auto hidden shrink-0 group-hover:block"
            title="Remove time (back to the day)"
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => {
              ev.stopPropagation();
              onUntime();
            }}
          >
            <Undo2 className="size-3" />
          </button>
        )}
      </div>
      <div className="text-muted-foreground truncate text-[10px]">
        {formatTime(entry.start)}–{formatTime(entry.end)}
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
        onPointerDown={(ev) => {
          ev.stopPropagation();
          ev.preventDefault();
          (ev.target as HTMLElement).setPointerCapture(ev.pointerId);
          resizing.current = { startY: ev.clientY, startEnd: e };
        }}
        onPointerMove={(ev) => {
          if (!resizing.current) return;
          const dh = (ev.clientY - resizing.current.startY) / HOUR_PX;
          const next = Math.max(s + SNAP_MIN / 60, snap(resizing.current.startEnd + dh));
          (ev.currentTarget.parentElement as HTMLElement).style.height = `${Math.max(18, (next - s) * HOUR_PX - 2)}px`;
        }}
        onPointerUp={(ev) => {
          if (!resizing.current) return;
          const dh = (ev.clientY - resizing.current.startY) / HOUR_PX;
          const next = Math.max(s + SNAP_MIN / 60, snap(resizing.current.startEnd + dh));
          resizing.current = null;
          if (next !== e) onResize(next);
        }}
      />
    </div>
  );
}

/** The untimed row of a day: work without a time + all-day events. Lives outside the scroller. */
function Strip({ date, work, allDay, onCompleteChip }: { date: DateStr; work: WorkItem[]; allDay: SurfaceTimedItem[]; onCompleteChip: (item: WorkItem) => void }) {
  const stripDrop = useDroppable({ id: `strip:${date}` });
  return (
    <div ref={stripDrop.setNodeRef} className={cn("min-h-12 max-h-32 space-y-1 overflow-y-auto border-l p-1", stripDrop.isOver && "bg-accent/40")}>
      {allDay.map((t) => (
        <Chip key={t.key} id={`timed:${t.key}`} data={{ timed: t }} title={t.title} color={t.color} />
      ))}
      {work.map((w) => (
        <Chip key={w.key} id={`item:${w.key}`} data={{ item: w }} title={w.title} color={w.color} done={!!w.completedOn} onComplete={() => onCompleteChip(w)} />
      ))}
      {allDay.length === 0 && work.length === 0 && <div className="text-muted-foreground px-1 text-[10px]">untimed</div>}
    </div>
  );
}

function DayColumn({
  date,
  from,
  to,
  entries,
  today,
  nowH,
  onSlotClick,
  onResize,
  onComplete,
  onUntime,
}: {
  date: DateStr;
  from: number;
  to: number;
  entries: Entry[];
  today: DateStr;
  nowH: number;
  onSlotClick: (date: DateStr, hours: number) => void;
  onResize: (entry: Entry, endHours: number) => void;
  onComplete: (item: SurfaceItem) => void;
  onUntime: (item: SurfaceItem) => void;
}) {
  const colDrop = useDroppable({ id: `col:${date}` });
  const height = (to - from) * HOUR_PX;
  const laid = useMemo(() => layoutColumns(entries.map((en) => ({ ...en, start: en.start, end: en.end }))), [entries]);
  return (
    <div className="flex min-w-0 flex-col">
      <div ref={colDrop.setNodeRef} className={cn("relative", colDrop.isOver && "bg-accent/20")} style={{ height }} data-col={date}>
        {Array.from({ length: to - from }, (_, i) => (
          <div
            key={i}
            className="border-border/60 absolute right-0 left-0 border-t"
            style={{ top: i * HOUR_PX, height: HOUR_PX }}
            onDoubleClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onSlotClick(date, snap(from + i + (e.clientY - rect.top) / HOUR_PX));
            }}
          />
        ))}
        {laid.map(({ item: en, col, cols }) => (
          <Block key={en.kind === "block" ? en.item.key : en.item.key} entry={en} from={from} col={col} cols={cols} onResize={(h) => onResize(en, h)} onComplete={en.kind === "block" ? () => onComplete(en.item) : undefined} onUntime={en.kind === "block" ? () => onUntime(en.item) : undefined} />
        ))}
        {date === today && nowH >= from && nowH <= to && (
          <div className="pointer-events-none absolute right-0 left-0 z-10 flex items-center" style={{ top: (nowH - from) * HOUR_PX }}>
            <span className="bg-destructive size-2 rounded-full" />
            <span className="bg-destructive h-px flex-1" />
          </div>
        )}
      </div>
    </div>
  );
}

function PoolColumn({ items, onComplete }: { items: WorkItem[]; onComplete: (item: WorkItem) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL });
  return (
    <div ref={setNodeRef} className={cn("flex min-h-0 flex-col rounded-lg border", isOver && "bg-accent/40")}>
      <div className="text-muted-foreground flex items-center gap-1 border-b px-2 py-1.5 text-xs font-medium">
        <Inbox className="size-3.5" /> Unplaced <span className="ml-auto">{items.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1">
        {items.map((w) => (
          <Chip key={w.key} id={`item:${w.key}`} data={{ item: w }} title={w.title} color={w.color} onComplete={() => onComplete(w)} />
        ))}
        {items.length === 0 && <div className="text-muted-foreground p-2 text-xs">Nothing unplaced.</div>}
      </div>
    </div>
  );
}

/**
 * The Schedule Surface (ADR 0015): hour-scaled day/week. Drag untimed work
 * (strip or pool) or a block onto a slot to plan it; drag back to the strip
 * to untime; resize the bottom edge; double-click an empty slot to add an
 * Event. Times live in Placements; Events retime through their App.
 */
export function SchedulePage() {
  const [params, setParams] = useSearchParams();
  const today = todayStr();
  const view = params.get("view") === "week" ? "week" : "day";
  const anchor: DateStr = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") ?? "") ? params.get("d")! : today;
  const days: DateStr[] = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)) : [anchor];
  const first = days[0];
  const last = days[days.length - 1];
  const go = (d: DateStr, v = view) => setParams({ ...(v === "week" ? { view: "week" } : {}), ...(d === today ? {} : { d }) });

  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const tags = composeTagFilter(tagFilter);
  const items = useSurfaceItems({ start: first, end: last }, { tags });
  const pool = usePoolItems({ tags });
  const timed = useTimedItems({ start: first, end: last }, { tags });
  const creator = timedCreators()[0];

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const nowH = now.getHours() + now.getMinutes() / 60;

  const timedIn = timed.filter((t) => t.start);
  const blocks = items.filter((i) => i.start);
  const { from, to } = useMemo(() => hourWindow([...timedIn, ...blocks.map((b) => ({ start: b.start!, end: b.end ?? null }))], 7, 23), [timedIn, blocks]);

  const entriesFor = (d: DateStr): Entry[] => [
    ...blocks.filter((b) => b.displayDate === d).map((b) => ({ kind: "block" as const, item: b, start: b.start!, end: b.end ?? addHours(b.start!, DEFAULT_MIN / 60) })),
    ...timedIn.filter((t) => t.date === d).map((t) => ({ kind: "timed" as const, item: t, start: t.start!, end: t.end ?? addHours(t.start!, 1) })),
  ];
  const stripFor = (d: DateStr) => ({
    work: items.filter((i) => i.displayDate === d && !i.start) as WorkItem[],
    allDay: timed.filter((t) => t.date === d && !t.start),
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [active, setActive] = useState<{ title: string } | null>(null);
  const pointer = useRef<{ y: number; grab: number }>({ y: 0, grab: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || !scroller.current) return;
    didScroll.current = true;
    scroller.current.scrollTop = Math.max(0, (Math.min(nowH, 23) - from - 1) * HOUR_PX);
  }, [nowH, from]);

  const fail = (err: Error) => toast.error(err.message);

  useEffect(() => {
    const track = (ev: PointerEvent) => {
      pointer.current.y = ev.clientY;
    };
    window.addEventListener("pointermove", track, { passive: true });
    return () => window.removeEventListener("pointermove", track);
  }, []);
  function onDragStart(e: DragStartEvent) {
    const ev = e.activatorEvent as PointerEvent;
    const d = e.active.data.current as { item?: WorkItem; timed?: SurfaceTimedItem; grab?: { current: number } };
    pointer.current = { y: ev.clientY, grab: d.grab?.current ?? 0 };
    setActive({ title: d.item?.title ?? d.timed?.title ?? "" });
  }
  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    if (!e.over) return;
    const overId = String(e.over.id);
    const d = e.active.data.current as { item?: WorkItem; timed?: SurfaceTimedItem };
    const isBlockDrag = String(e.active.id).startsWith("block:") || String(e.active.id).startsWith("timed:");
    if (overId.startsWith("col:")) {
      const date = overId.slice(4);
      // Live rect at drop time: the container may have auto-scrolled during the drag.
      const colEl = document.querySelector<HTMLElement>(`[data-col="${date}"]`);
      const colTop = colEl ? colEl.getBoundingClientRect().top : e.over.rect.top;
      const top = pointer.current.y - (isBlockDrag ? pointer.current.grab : 8) - colTop;
      const startH = Math.max(from, Math.min(to - SNAP_MIN / 60, snap(from + top / HOUR_PX)));
      const start = toClock(startH);
      if (d.item) {
        const dur = d.item.start ? durationOf(d.item.start, d.item.end) : DEFAULT_MIN / 60;
        scheduleSurfaceItem(d.item as SurfaceItem, date, { start, end: addHours(start, dur) }).catch(fail);
      } else if (d.timed) {
        if (!canRescheduleTimed(d.timed.appId)) return void toast.error("This item can't be retimed here");
        const dur = d.timed.start ? durationOf(d.timed.start, d.timed.end, 60) : 1;
        rescheduleTimedItem(d.timed, date, start, addHours(start, dur)).catch(fail);
      }
      return;
    }
    if (overId.startsWith("strip:")) {
      const date = overId.slice(6);
      if (d.item) scheduleSurfaceItem(d.item as SurfaceItem, date, null).catch(fail);
      else if (d.timed) {
        if (canRescheduleTimed(d.timed.appId)) rescheduleTimedItem(d.timed, date, null, null).catch(fail);
        else if (d.timed.date !== date) moveTimedItem(d.timed, date).catch(fail);
      }
      return;
    }
    if (overId === POOL && d.item) {
      moveSurfaceItem(d.item as SurfaceItem, null).catch(fail);
    }
  }

  const [creating, setCreating] = useState<{ date: DateStr; hours: number } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  async function createAt() {
    if (!creating || !newTitle.trim() || !creator?.create) return;
    const start = toClock(creating.hours);
    await creator.create({ title: newTitle.trim(), date: creating.date, start, end: addHours(start, 1) });
    toast.success(`${newTitle.trim()} at ${formatTime(start)}`);
    setCreating(null);
    setNewTitle("");
  }

  const label = view === "week" ? `${formatHuman(first)} – ${formatHuman(last)}` : formatHuman(anchor);
  const openCount = items.filter((i) => !i.completedOn).length;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="flex h-full flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Schedule</h1>
          <span className="text-muted-foreground text-sm">{label}</span>
          <Badge variant="secondary">{openCount} open</Badge>
          <div className="ml-auto flex items-center gap-1">
            <TagFilterBar value={tagFilter} onChange={setTagFilter} className="mr-2" />
            <div className="bg-muted/60 mr-2 grid grid-cols-2 gap-0.5 rounded-lg p-0.5">
              {(["day", "week"] as const).map((v) => (
                <button key={v} className={cn("rounded-md px-2 py-1 text-xs font-medium capitalize", view === v ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => go(anchor, v)}>
                  {v}
                </button>
              ))}
            </div>
            <Button size="icon" variant="outline" className="size-8" onClick={() => go(addDays(anchor, view === "week" ? -7 : -1))} aria-label="Previous">
              <ChevronLeft />
            </Button>
            <Button variant="outline" className="h-8" onClick={() => go(today)}>
              Today
            </Button>
            <Button size="icon" variant="outline" className="size-8" onClick={() => go(addDays(anchor, view === "week" ? 7 : 1))} aria-label="Next">
              <ChevronRight />
            </Button>
            <Input type="date" className="h-8 w-36" value={anchor} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Jump to date" />
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[13rem_1fr] gap-2">
          <PoolColumn items={pool as WorkItem[]} onComplete={(w) => completeSurfaceItem(w as SurfaceItem).catch(fail)} />
          <div className="flex min-h-0 min-w-0 flex-col rounded-lg border">
            <div className="grid shrink-0 border-b" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
              <div />
              {days.map((d) => (
                <div key={d} className={cn("border-l px-2 py-1 text-xs", d === today && "text-primary font-semibold")}>
                  {DAY_NAMES[(new Date(d + "T12:00:00").getDay() + 6) % 7]} <span className="text-muted-foreground">{parts(d).day}</span>
                </div>
              ))}
            </div>
            <div className="grid shrink-0 border-b" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
              <div className="text-muted-foreground px-1 pt-1 text-[10px]">all day</div>
              {days.map((d) => {
                const st = stripFor(d);
                return <Strip key={d} date={d} work={st.work} allDay={st.allDay} onCompleteChip={(w) => completeSurfaceItem(w as SurfaceItem).then(() => toast.success(`${w.title} done`)).catch(fail)} />;
              })}
            </div>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid" style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="relative">
                  <div className="relative" style={{ height: (to - from) * HOUR_PX }}>
                    {Array.from({ length: to - from }, (_, i) => (
                      <div key={i} className="text-muted-foreground absolute right-1 -translate-y-1.5 text-[10px] tabular-nums" style={{ top: i * HOUR_PX }}>
                        {formatTime(`${String(from + i).padStart(2, "0")}:00`)}
                      </div>
                    ))}
                  </div>
                </div>
                {days.map((d) => (
                  <div key={d} className={cn("border-l", d < today && "bg-muted/20")}>
                    <DayColumn
                      date={d}
                      from={from}
                      to={to}
                      entries={entriesFor(d)}
                      today={today}
                      nowH={nowH}
                      onSlotClick={(date, hours) => {
                        if (!creator?.create) return;
                        setCreating({ date, hours });
                      }}
                      onResize={(en, endH) => {
                        const end = toClock(endH);
                        if (en.kind === "block") scheduleSurfaceItem(en.item, en.item.displayDate, { start: en.start, end }).catch(fail);
                        else if (canRescheduleTimed(en.item.appId)) rescheduleTimedItem(en.item, en.item.date, en.start, end).catch(fail);
                      }}
                      onComplete={(it) => completeSurfaceItem(it).then(() => toast.success(`${it.title} done`)).catch(fail)}
                      onUntime={(it) => scheduleSurfaceItem(it, it.displayDate, null).catch(fail)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground text-[11px]">Drag work into a slot to plan it · drag to the top strip to untime · resize the bottom edge · double-click a slot to add an event.</p>
      </div>

      <DragOverlay dropAnimation={null}>{active && <div className="bg-card rounded-md border px-2 py-1 text-xs shadow-md">{active.title}</div>}</DragOverlay>

      <Dialog open={creating !== null} onOpenChange={(o) => !o && setCreating(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>
              New event {creating && `· ${formatHuman(creating.date)} ${formatTime(toClock(creating.hours))}`}
            </DialogTitle>
          </DialogHeader>
          <Input autoFocus placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void createAt()} />
          <DialogFooter>
            <Button onClick={() => void createAt()} disabled={!newTitle.trim()}>
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}

