import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Badge, Button, cn, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import {
  addDays,

  canRescheduleTimed,
  completeSurfaceItem,
  composeTagFilter,
  createFromTimedTemplate,
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
  unplaceItem,
  usePoolItems,
  useSurfaceItems,
  useTimedItems,
  useTimedTemplates,
  type DateStr,
  type PoolItem,
  type SurfaceItem,
  type SurfaceTimedItem,
  type TimedTemplate,
} from "@lifeline/core";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Inbox, LayoutTemplate, Plus, Trash2, Zap } from "lucide-react";
import { TagFilterBar } from "../components/TagFilterBar";
import { useIsMobile } from "../mobile/useIsMobile";

const HOUR_PX = 56;
const SNAP_MIN = 15;
const DEFAULT_MIN = 30;
const POOL = "pool";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type WorkItem = (SurfaceItem | (PoolItem & { displayDate?: undefined; placementId?: undefined; start?: undefined; end?: undefined })) & { color?: string };
type Entry = { kind: "block"; item: SurfaceItem; start: string; end: string } | { kind: "timed"; item: SurfaceTimedItem; start: string; end: string };
/** A Time blocker's band on one day (ADR 0027): painted behind everything. A weekly rule's band is fixed; a one-off's (ADR 0029) drags and resizes. */
type Band = { key: string; title: string; start: string; end: string; color?: string; fixed: boolean; item: SurfaceTimedItem };

/** The hour gutter's label: "1:00 PM" with room, bare "1 PM" on a phone. */
function hourLabel(hour: number, compact: boolean): string {
  return new Date(Date.UTC(2000, 0, 1, hour, 0)).toLocaleTimeString(undefined, {
    hour: "numeric",
    ...(compact ? {} : { minute: "2-digit" }),
    timeZone: "UTC",
  });
}

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

/**
 * A draggable chip: an untimed work item (strip or pool) or an all-day timed
 * item. A chip is a source (ADR 0028): dragging it onto an hour makes a new
 * Time block and leaves the chip here, greyed while `planned` blocks lie ahead.
 */
function Chip({ id, data, title, color, done, planned, onComplete }: { id: string; data: Record<string, unknown>; title: string; color?: string; done?: boolean; planned?: number; onComplete?: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  const scheduled = !!planned && planned > 0;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("bg-card flex cursor-grab items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs select-none", isDragging && "opacity-40", (done || scheduled) && "opacity-60", scheduled && "border-dashed")}
      title={scheduled ? `${title} · ${planned} block${planned === 1 ? "" : "s"} planned — drag again for another` : title}
    >
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
      {scheduled && <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">×{planned}</span>}
      <span className={cn("size-1.5 shrink-0 rounded-full", !scheduled && "ml-auto")} style={{ background: color ?? "var(--muted-foreground)" }} />
    </div>
  );
}

/** A block on the timeline: draggable, resizable at the bottom edge. */
function Block({ entry, from, cols, col, onResize, onComplete, onRemove }: { entry: Entry; from: number; cols: number; col: number; onResize: (endHours: number) => void; onComplete?: () => void; onRemove?: () => void }) {
  const isBlock = entry.kind === "block";
  // One item may have several blocks (ADR 0028): the Placement, not the item, is the draggable.
  const id = isBlock ? `block:${entry.item.placementId}` : `timed:${entry.item.key}`;
  const grab = useRef(0);
  const data = isBlock ? { item: entry.item, grab } : { timed: entry.item, grab };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  const s = toHours(entry.start);
  const e = toHours(entry.end);
  const done = isBlock && !!entry.item.completedOn;
  const short = (e - s) * HOUR_PX < 34;
  const color = entry.item.color ?? "var(--muted-foreground)";
  const resizing = useRef<{ startY: number; startEnd: number } | null>(null);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("group absolute z-[2] cursor-grab overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-xs shadow-sm select-none", isDragging && "opacity-40", done && "opacity-60")}
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
        {isBlock && onRemove && (
          <button
            className="text-muted-foreground hover:text-foreground ml-auto hidden shrink-0 group-hover:block"
            title="Remove this block"
            onPointerDown={(ev) => ev.stopPropagation()}
            onClick={(ev) => {
              ev.stopPropagation();
              onRemove();
            }}
          >
            <Trash2 className="size-3" />
          </button>
        )}
      </div>
      {!short && (
        <div className="text-muted-foreground truncate text-[10px]">
          {formatTime(entry.start)}–{formatTime(entry.end)}
        </div>
      )}
      <div
        className={cn("absolute inset-x-0 bottom-0 cursor-ns-resize touch-none", short ? "h-1.5" : "h-2 max-md:h-3")}
        aria-hidden
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
      >
        {!short && <span className="bg-foreground/30 absolute inset-x-0 bottom-0.5 mx-auto h-0.5 w-6 rounded-full md:hidden" />}
      </div>
    </div>
  );
}

/** The untimed row of a day: work without a time + all-day events. Lives outside the scroller. */
function Strip({ date, work, allDay, onCompleteChip }: { date: DateStr; work: WorkItem[]; allDay: SurfaceTimedItem[]; onCompleteChip: (item: WorkItem) => void }) {
  const stripDrop = useDroppable({ id: `strip:${date}` });
  return (
    <div ref={stripDrop.setNodeRef} className={cn("min-h-12 max-h-32 space-y-1 overflow-y-auto border-l p-1 max-md:max-h-24", stripDrop.isOver && "bg-accent/40")}>
      {allDay.map((t) => (
        <Chip key={t.key} id={`timed:${t.key}`} data={{ timed: t }} title={t.title} color={t.color} />
      ))}
      {work.map((w) => (
        <Chip key={w.key} id={`item:${w.key}`} data={{ item: w }} title={w.title} color={w.color} done={!!w.completedOn} planned={w.blocksAhead} onComplete={() => onCompleteChip(w)} />
      ))}
      {allDay.length === 0 && work.length === 0 && <div className="text-muted-foreground px-1 text-[10px]">untimed</div>}
    </div>
  );
}

/** One Time blocker band, clipped to the visible hours. A weekly band is inert; a one-off band drags and resizes (ADR 0029). */
function BandLayer({ band, from, to, onResize }: { band: Band; from: number; to: number; onResize: (endHours: number) => void }) {
  const s = Math.max(from, toHours(band.start));
  const e = Math.min(to, toHours(band.end));
  const color = band.color ?? "var(--muted-foreground)";
  const style = {
    top: (s - from) * HOUR_PX,
    height: (e - s) * HOUR_PX,
    background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${color} 14%, transparent) 0 6px, transparent 6px 12px)`,
    borderColor: `color-mix(in oklab, ${color} 35%, transparent)`,
  };
  const title = `${formatTime(band.start)}–${formatTime(band.end)} ${band.title}`;
  if (e <= s) return null;
  if (band.fixed) {
    return (
      <div className="pointer-events-none absolute inset-x-0 z-0 overflow-hidden border-y" style={style} title={title}>
        <span className="text-muted-foreground absolute top-0.5 left-1 truncate text-[10px]">{band.title}</span>
      </div>
    );
  }
  return <OneOffBand band={band} s={s} e={e} style={style} title={title} onResize={onResize} />;
}

/** A one-off blocker's band: still behind everything, but a draggable with a resize edge. */
function OneOffBand({ band, s, e, style, title, onResize }: { band: Band; s: number; e: number; style: React.CSSProperties; title: string; onResize: (endHours: number) => void }) {
  const grab = useRef(0);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `timed:${band.item.key}`, data: { timed: band.item, grab } });
  const resizing = useRef<{ startY: number; startEnd: number } | null>(null);
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("absolute inset-x-0 z-[1] cursor-grab overflow-hidden border-y select-none", isDragging && "opacity-40")}
      style={style}
      title={`${title} · one-off, drag to move`}
      onPointerDownCapture={(ev) => {
        grab.current = ev.clientY - ev.currentTarget.getBoundingClientRect().top;
      }}
    >
      <span className="text-muted-foreground absolute top-0.5 left-1 truncate text-[10px]">{band.title}</span>
      <div
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none max-md:h-3"
        aria-hidden
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
          (ev.currentTarget.parentElement as HTMLElement).style.height = `${(next - s) * HOUR_PX}px`;
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

function DayColumn({
  date,
  from,
  to,
  entries,
  bands,
  today,
  nowH,
  onSlotClick,
  onResize,
  onBandResize,
  onComplete,
  onRemove,
}: {
  date: DateStr;
  from: number;
  to: number;
  entries: Entry[];
  bands: Band[];
  today: DateStr;
  nowH: number;
  onSlotClick: (date: DateStr, hours: number) => void;
  onResize: (entry: Entry, endHours: number) => void;
  onBandResize: (band: Band, endHours: number) => void;
  onComplete: (item: SurfaceItem) => void;
  onRemove: (item: SurfaceItem) => void;
}) {
  const colDrop = useDroppable({ id: `col:${date}` });
  const height = (to - from) * HOUR_PX;
  const laid = useMemo(() => layoutColumns(entries.map((en) => ({ ...en, start: en.start, end: en.end }))), [entries]);
  return (
    <div className="flex min-w-0 flex-col">
      <div ref={colDrop.setNodeRef} className={cn("relative", colDrop.isOver && "bg-accent/20")} style={{ height }} data-col={date}>
        {bands.map((b) => (
          <BandLayer key={b.key} band={b} from={from} to={to} onResize={(h) => onBandResize(b, h)} />
        ))}
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
          <Block key={en.kind === "block" ? en.item.placementId : en.item.key} entry={en} from={from} col={col} cols={cols} onResize={(h) => onResize(en, h)} onComplete={en.kind === "block" ? () => onComplete(en.item) : undefined} onRemove={en.kind === "block" ? () => onRemove(en.item) : undefined} />
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

/**
 * A draggable template chip: drop it on a slot, or add it to the open day
 * with one tap. A Blocker template (ADR 0029) is drawn hatched — it makes a
 * band, not a thing — and has no bolt: a band needs a slot.
 */
function TemplateChip({ template, onAdd }: { template: TimedTemplate; onAdd: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `tpl:${template.key}`, data: { template } });
  const color = template.color ?? "var(--muted-foreground)";
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("bg-card flex cursor-grab items-center gap-1.5 rounded-md border border-dashed px-1.5 py-1 text-xs select-none", isDragging && "opacity-40")}
      style={template.background ? { background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${color} 14%, transparent) 0 6px, transparent 6px 12px)` } : undefined}
      title={template.subtitle ? `${template.title} · ${template.subtitle}` : template.title}
    >
      <span className="truncate">{template.title}</span>
      <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">
        {template.durationMin === null ? "all day" : template.durationMin >= 60 ? `${Math.round((template.durationMin / 60) * 10) / 10}h` : `${template.durationMin}m`}
      </span>
      {!template.background && (
      <button
        className="hover:bg-accent flex size-4 shrink-0 items-center justify-center rounded-full border"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        aria-label={`Add ${template.title}`}
      >
        <Zap className="size-2.5" />
      </button>
      )}
    </div>
  );
}

/**
 * The Event templates palette (ADR 0027): the shapes the Calendar App offers
 * for quick add. Drag one onto an hour to plan it there; the bolt puts it on
 * the open day at its usual time.
 */
function TemplatePalette({ templates, onAdd, collapsible }: { templates: TimedTemplate[]; onAdd: (t: TimedTemplate) => void; collapsible?: boolean }) {
  const [open, setOpen] = useState(false);
  if (templates.length === 0) return null;
  const chips = templates.map((t) => <TemplateChip key={t.key} template={t} onAdd={() => onAdd(t)} />);
  if (collapsible) {
    return (
      <div className="shrink-0 rounded-lg border">
        <button className="text-muted-foreground flex w-full items-center gap-1 px-2 py-1.5 text-xs font-medium" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <LayoutTemplate className="size-3.5" /> Templates <span className="ml-auto tabular-nums">{templates.length}</span>
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {open && <div className="max-h-40 space-y-1 overflow-y-auto border-t p-1">{chips}</div>}
      </div>
    );
  }
  return (
    <div className="flex max-h-56 shrink-0 flex-col rounded-lg border">
      <div className="text-muted-foreground flex items-center gap-1 border-b px-2 py-1.5 text-xs font-medium">
        <LayoutTemplate className="size-3.5" /> Templates <span className="ml-auto">{templates.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1">{chips}</div>
    </div>
  );
}

/**
 * The Unplaced pool: a full-height column beside the grid on the desktop, a
 * collapsed drawer above it on a phone (where the grid needs the whole width).
 */
function PoolColumn({ items, onComplete, collapsible }: { items: WorkItem[]; onComplete: (item: WorkItem) => void; collapsible?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL });
  const [open, setOpen] = useState(false);
  const chips = items.map((w) => (
    <Chip key={w.key} id={`item:${w.key}`} data={{ item: w }} title={w.title} color={w.color} planned={w.blocksAhead} onComplete={() => onComplete(w)} />
  ));
  if (collapsible) {
    return (
      <div ref={setNodeRef} className={cn("shrink-0 rounded-lg border", isOver && "bg-accent/40")}>
        <button className="text-muted-foreground flex w-full items-center gap-1 px-2 py-1.5 text-xs font-medium" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Inbox className="size-3.5" /> Unplaced <span className="ml-auto tabular-nums">{items.length}</span>
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <div className="max-h-40 space-y-1 overflow-y-auto border-t p-1">
            {chips}
            {items.length === 0 && <div className="text-muted-foreground p-2 text-xs">Nothing unplaced.</div>}
          </div>
        )}
      </div>
    );
  }
  return (
    <div ref={setNodeRef} className={cn("flex min-h-0 flex-1 flex-col rounded-lg border", isOver && "bg-accent/40")}>
      <div className="text-muted-foreground flex items-center gap-1 border-b px-2 py-1.5 text-xs font-medium">
        <Inbox className="size-3.5" /> Unplaced <span className="ml-auto">{items.length}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1">
        {chips}
        {items.length === 0 && <div className="text-muted-foreground p-2 text-xs">Nothing unplaced.</div>}
      </div>
    </div>
  );
}

/** Phone-only week navigator: the anchor's week as seven tappable days. */
function DayStrip({ anchor, today, onPick }: { anchor: DateStr; today: DateStr; onPick: (d: DateStr) => void }) {
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i));
  return (
    <div className="flex shrink-0 gap-1">
      {week.map((d) => {
        const active = d === anchor;
        return (
          <button
            key={d}
            onClick={() => onPick(d)}
            aria-current={active ? "date" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center rounded-md border py-1 text-[10px] leading-tight",
              active ? "bg-primary text-primary-foreground border-primary" : d === today ? "text-primary" : "text-muted-foreground",
            )}
          >
            {DAY_NAMES[(new Date(d + "T12:00:00").getDay() + 6) % 7]}
            <span className="text-sm font-medium tabular-nums">{parts(d).day}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The Schedule Surface (ADR 0015): hour-scaled day/week. Chips (strip or
 * pool) are sources: drag one onto a slot to make a Time block and the chip
 * stays, greyed while blocks lie ahead (ADR 0028); drag a block to move that
 * block alone; drag it to the strip or the pool to remove it. Resize the
 * bottom edge; double-click an empty slot to add an Event. Times live in
 * Placements; Events and one-off blockers (ADR 0029) retime through their App.
 */
export function SchedulePage() {
  const [params, setParams] = useSearchParams();
  const isMobile = useIsMobile();
  const today = todayStr();
  // Seven columns cannot be read or dropped into on a phone: below `md` the
  // Surface is always the single day, navigated by the day strip.
  const view = !isMobile && params.get("view") === "week" ? "week" : "day";
  const anchor: DateStr = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") ?? "") ? params.get("d")! : today;
  const days: DateStr[] = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i)) : [anchor];
  const first = days[0];
  const last = days[days.length - 1];
  const go = (d: DateStr, v = view) => setParams({ ...(v === "week" ? { view: "week" } : {}), ...(d === today ? {} : { d }) });

  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const tags = composeTagFilter(tagFilter);
  const items = useSurfaceItems({ start: first, end: last }, { tags });
  const pool = usePoolItems({ tags });
  const allTimed = useTimedItems({ start: first, end: last }, { tags });
  // Time blockers arrive through the Timed contract as background items (ADR 0027): bands, not things.
  const timed = allTimed.filter((t) => !t.background);
  const bandItems = allTimed.filter((t) => t.background && t.start);
  const templates = useTimedTemplates();
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
  const bandsFor = (d: DateStr): Band[] =>
    bandItems
      .filter((b) => b.date === d)
      .map((b) => ({ key: b.key, title: b.title, start: b.start!, end: b.end ?? "24:00", color: b.color, fixed: !!b.fixed, item: b }));
  const stripFor = (d: DateStr) => ({
    work: items.filter((i) => i.displayDate === d && !i.start) as WorkItem[],
    allDay: timed.filter((t) => t.date === d && !t.start),
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );
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
    const trackTouch = (ev: TouchEvent) => {
      if (ev.touches[0]) pointer.current.y = ev.touches[0].clientY;
    };
    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("touchmove", trackTouch, { passive: true });
    return () => {
      window.removeEventListener("pointermove", track);
      window.removeEventListener("touchmove", trackTouch);
    };
  }, []);
  function onDragStart(e: DragStartEvent) {
    const ev = e.activatorEvent as PointerEvent | TouchEvent;
    const y = "clientY" in ev ? ev.clientY : (ev.touches[0]?.clientY ?? 0);
    const d = e.active.data.current as { item?: WorkItem; timed?: SurfaceTimedItem; template?: TimedTemplate; grab?: { current: number } };
    pointer.current = { y, grab: d.grab?.current ?? 0 };
    setActive({ title: d.item?.title ?? d.timed?.title ?? d.template?.title ?? "" });
  }
  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    if (!e.over) return;
    const overId = String(e.over.id);
    const d = e.active.data.current as { item?: WorkItem; timed?: SurfaceTimedItem; template?: TimedTemplate };
    const isBlockDrag = String(e.active.id).startsWith("block:") || String(e.active.id).startsWith("timed:");
    if (overId.startsWith("col:")) {
      const date = overId.slice(4);
      // Live rect at drop time: the container may have auto-scrolled during the drag.
      const colEl = document.querySelector<HTMLElement>(`[data-col="${date}"]`);
      const colTop = colEl ? colEl.getBoundingClientRect().top : e.over.rect.top;
      const top = pointer.current.y - (isBlockDrag ? pointer.current.grab : 8) - colTop;
      const startH = Math.max(from, Math.min(to - SNAP_MIN / 60, snap(from + top / HOUR_PX)));
      const start = toClock(startH);
      if (d.template) {
        const t = d.template;
        createFromTimedTemplate(t, date, t.durationMin === null ? null : start)
          .then(() => toast.success(t.durationMin === null ? `${t.title} on ${formatHuman(date)}` : `${t.title} ${t.background ? "blocked" : ""} at ${formatTime(start)}`.replace("  ", " ")))
          .catch(fail);
        return;
      }
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
      // A block dropped here is removed, the item untouched; a chip goes back to the pool (ADR 0028).
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

  /** The bolt on a template chip: onto the open day, at the template's own time. */
  function addTemplate(t: TimedTemplate) {
    if (t.background) return void toast.error("Drop a blocker template on an hour");
    createFromTimedTemplate(t, anchor, null)
      .then(() => toast.success(`${t.title} on ${formatHuman(anchor)}`))
      .catch(fail);
  }

  const gutter = isMobile ? "2.5rem" : "3rem";
  const label = view === "week" ? `${formatHuman(first)} – ${formatHuman(last)}` : formatHuman(anchor);
  const openCount = items.filter((i) => !i.start && !i.completedOn).length;

  return (
    <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
      <div className="flex h-full flex-col gap-3 p-4 max-md:gap-2 max-md:p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Schedule</h1>
          <span className="text-muted-foreground text-sm">{label}</span>
          <Badge variant="secondary">{openCount} open</Badge>
          <div className="ml-auto flex items-center gap-1">
            <TagFilterBar value={tagFilter} onChange={setTagFilter} className="mr-2" />
            <div className="bg-muted/60 mr-2 grid grid-cols-2 gap-0.5 rounded-lg p-0.5 max-md:hidden">
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
            <Input type="date" className="h-8 w-36 max-md:hidden" value={anchor} onChange={(e) => e.target.value && go(e.target.value)} aria-label="Jump to date" />
            {creator?.create && (
              <Button
                size="icon"
                variant="outline"
                className="size-8 md:hidden"
                aria-label="New event"
                onClick={() => setCreating({ date: anchor, hours: anchor === today ? Math.min(snap(nowH), to - 1) : Math.max(from, 9) })}
              >
                <Plus />
              </Button>
            )}
          </div>
        </div>

        {isMobile && <DayStrip anchor={anchor} today={today} onPick={(d) => go(d)} />}

        <div className="grid min-h-0 flex-1 grid-cols-[13rem_1fr] gap-2 max-md:flex max-md:flex-col">
          <div className="flex min-h-0 flex-col gap-2 max-md:contents">
            <PoolColumn items={pool as WorkItem[]} onComplete={(w) => completeSurfaceItem(w as SurfaceItem).catch(fail)} collapsible={isMobile} />
            <TemplatePalette templates={templates} onAdd={addTemplate} collapsible={isMobile} />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col rounded-lg border max-md:flex-1">
            <div className="grid shrink-0 border-b max-md:hidden" style={{ gridTemplateColumns: `${gutter} repeat(${days.length}, minmax(0, 1fr))` }}>
              <div />
              {days.map((d) => (
                <div key={d} className={cn("border-l px-2 py-1 text-xs", d === today && "text-primary font-semibold")}>
                  {DAY_NAMES[(new Date(d + "T12:00:00").getDay() + 6) % 7]} <span className="text-muted-foreground">{parts(d).day}</span>
                </div>
              ))}
            </div>
            <div className="grid shrink-0 border-b" style={{ gridTemplateColumns: `${gutter} repeat(${days.length}, minmax(0, 1fr))` }}>
              <div className="text-muted-foreground px-1 pt-1 text-[10px]">all day</div>
              {days.map((d) => {
                const st = stripFor(d);
                return <Strip key={d} date={d} work={st.work} allDay={st.allDay} onCompleteChip={(w) => completeSurfaceItem(w as SurfaceItem).then(() => toast.success(`${w.title} done`)).catch(fail)} />;
              })}
            </div>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid" style={{ gridTemplateColumns: `${gutter} repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="relative">
                  <div className="relative" style={{ height: (to - from) * HOUR_PX }}>
                    {Array.from({ length: to - from }, (_, i) => (
                      <div key={i} className="text-muted-foreground absolute right-1 -translate-y-1.5 text-[10px] tabular-nums" style={{ top: i * HOUR_PX }}>
                        {hourLabel(from + i, isMobile)}
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
                      bands={bandsFor(d)}
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
                      onBandResize={(b, endH) => {
                        if (canRescheduleTimed(b.item.appId)) rescheduleTimedItem(b.item, b.item.date, b.start, toClock(endH)).catch(fail);
                      }}
                      onComplete={(it) => completeSurfaceItem(it).then(() => toast.success(`${it.title} done`)).catch(fail)}
                      onRemove={(it) => (it.placementId ? unplaceItem(it.placementId).catch(fail) : undefined)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground shrink-0 text-[11px]">
          {isMobile
            ? "Press and hold to drag · + adds an event · ⚡ adds a template to this day."
            : "Drag work or a template into a slot to plan it — a chip stays and can be planned again · drag a block to the strip or the pool to remove it · resize the bottom edge · double-click a slot to add an event · shaded bands are your time blockers; one-off bands drag."}
        </p>
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
          {templates.some((t) => !t.background) && (
            <div className="grid gap-1.5">
              <span className="text-muted-foreground text-xs">Or from a template</span>
              <div className="flex flex-wrap gap-1.5">
                {templates.filter((t) => !t.background).map((t) => (
                  <Button
                    key={t.key}
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!creating) return;
                      const start = toClock(creating.hours);
                      createFromTimedTemplate(t, creating.date, t.durationMin === null ? null : start)
                        .then(() => toast.success(t.durationMin === null ? `${t.title} on ${formatHuman(creating.date)}` : `${t.title} at ${formatTime(start)}`))
                        .catch(fail);
                      setCreating(null);
                      setNewTitle("");
                    }}
                  >
                    {t.title}
                  </Button>
                ))}
              </div>
            </div>
          )}
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

