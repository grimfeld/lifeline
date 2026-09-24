import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";
import { Badge, Button, cn, Input, toast } from "@lifeline/ui";
import {
  BLOCK_DEFAULT_MIN,
  canPush,
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
  useIsMobile,
  type DateStr,
  type PoolItem,
  type SurfaceItem,
  type SurfaceTimedItem,
  type TimedTemplate,
} from "@lifeline/core";
import { CalendarClock, Check, ChevronDown, ChevronLeft, ChevronRight, Inbox, LayoutTemplate, Plus, Trash2, Zap } from "lucide-react";
import { usePush } from "./push";
import { TagFilterBar } from "../components/TagFilterBar";
import { HoursEditor, type HoursEditing, type HoursTarget } from "./HoursEditor";
import { AddAtHour, type AddingAt } from "./AddAtHour";
import { SNAP_MIN, snap, toClock } from "./hours";

const HOUR_PX = 56;
/** Long enough that a flick to scroll never lifts a block; short enough to feel like a press. */
const LONG_PRESS_MS = 350;
const DEFAULT_MIN = BLOCK_DEFAULT_MIN;
const POOL = "pool";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type WorkItem = (SurfaceItem | (PoolItem & { displayDate?: undefined; placementId?: undefined; start?: undefined; end?: undefined })) & { color?: string };
type Entry = { kind: "block"; item: SurfaceItem; start: string; end: string } | { kind: "timed"; item: SurfaceTimedItem; start: string; end: string };
/** Where a lifted item will land: drawn in the grid while the drag hovers a day. */
type Ghost = { date: DateStr; startH: number; lenH: number };
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

function durationOf(start: string, end: string | null | undefined, fallbackMin = DEFAULT_MIN): number {
  return end ? Math.max(SNAP_MIN / 60, toHours(end) - toHours(start)) : fallbackMin / 60;
}
function addHours(start: string, h: number): string {
  return toClock(Math.min(24, toHours(start) + h));
}

/** Push (ADR 0054) on a chip or block: a small icon that must not start a drag. Nothing where Push is not offered. */
function PushIcon({ item, className }: { item: WorkItem; className?: string }) {
  const push = usePush(item);
  if (!push) return null;
  return (
    <button
      className={cn("text-muted-foreground hover:text-foreground shrink-0", className)}
      title="Push — find it time"
      aria-label={`Push ${item.title}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        push();
      }}
    >
      <CalendarClock className="size-3" />
    </button>
  );
}

/**
 * A draggable chip: an untimed work item (strip or pool) or an all-day timed
 * item. A chip is a source (ADR 0028): dragging it onto an hour makes a new
 * Time block and leaves the chip here, greyed while `planned` blocks lie ahead.
 */
function Chip({ id, data, title, color, done, planned, onComplete, work, onOpen }: { id: string; data: Record<string, unknown>; title: string; color?: string; done?: boolean; planned?: number; onComplete?: () => void; work?: WorkItem; onOpen?: (el: HTMLElement) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  const scheduled = !!planned && planned > 0;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn("group bg-card flex cursor-grab items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs select-none max-md:py-1.5", isDragging && "opacity-40", (done || scheduled) && "opacity-60", scheduled && "border-dashed")}
      onClick={(ev) => onOpen?.(ev.currentTarget)}
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
      {work && <PushIcon item={work} className="hidden group-hover:block max-md:block" />}
      {scheduled && <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">×{planned}</span>}
      <span className={cn("size-1.5 shrink-0 rounded-full", !scheduled && "ml-auto")} style={{ background: color ?? "var(--muted-foreground)" }} />
    </div>
  );
}

/** A block on the timeline: draggable, resizable at the bottom edge. */
function Block({ entry, from, cols, col, touch, onResize, onComplete, onRemove, onOpen }: { entry: Entry; from: number; cols: number; col: number; touch: boolean; onResize: (endHours: number) => void; onComplete?: () => void; onRemove?: () => void; onOpen: (el: HTMLElement) => void }) {
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
      onClick={(ev) => onOpen(ev.currentTarget)}
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
        {isBlock && <PushIcon item={entry.item} className="ml-auto hidden group-hover:block" />}
        {isBlock && onRemove && (
          <button
            className={cn("text-muted-foreground hover:text-foreground hidden shrink-0 group-hover:block", !canPush(entry.item.appId) && "ml-auto")}
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
      {/* On a phone the edge was a 12px target that fought the scroll: length is set in the editor there. */}
      {!touch && (
      <div
        className={cn("absolute inset-x-0 bottom-0 cursor-ns-resize touch-none", short ? "h-1.5" : "h-2")}
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
        onClick={(ev) => ev.stopPropagation()}
      />
      )}
    </div>
  );
}

/** The untimed row of a day: work without a time + all-day events. Lives outside the scroller. */
function Strip({ date, work, allDay, onCompleteChip, onOpen }: { date: DateStr; work: WorkItem[]; allDay: SurfaceTimedItem[]; onCompleteChip: (item: WorkItem) => void; onOpen: (target: HoursTarget, el: HTMLElement) => void }) {
  const stripDrop = useDroppable({ id: `strip:${date}` });
  return (
    <div ref={stripDrop.setNodeRef} className={cn("min-h-12 max-h-32 space-y-1 overflow-y-auto border-l p-1 max-md:max-h-24", stripDrop.isOver && "bg-accent/40")}>
      {allDay.map((t) => (
        <Chip key={t.key} id={`timed:${t.key}`} data={{ timed: t }} title={t.title} color={t.color} onOpen={(el) => onOpen({ kind: "timed", item: t }, el)} />
      ))}
      {work.map((w) => (
        <Chip key={w.key} id={`item:${w.key}`} data={{ item: w }} title={w.title} color={w.color} done={!!w.completedOn} planned={w.blocksAhead} onComplete={() => onCompleteChip(w)} work={w} onOpen={(el) => onOpen({ kind: "work", item: w }, el)} />
      ))}
      {allDay.length === 0 && work.length === 0 && <div className="text-muted-foreground px-1 text-[10px]">untimed</div>}
    </div>
  );
}

/** One Time blocker band, clipped to the visible hours. A weekly band is inert; a one-off band drags and resizes (ADR 0029). */
function BandLayer({ band, from, to, touch, onResize, onOpen }: { band: Band; from: number; to: number; touch: boolean; onResize: (endHours: number) => void; onOpen: (el: HTMLElement) => void }) {
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
  return <OneOffBand band={band} s={s} e={e} style={style} title={title} touch={touch} onResize={onResize} onOpen={onOpen} />;
}

/** A one-off blocker's band: still behind everything, but a draggable with a resize edge. */
function OneOffBand({ band, s, e, style, title, touch, onResize, onOpen }: { band: Band; s: number; e: number; style: React.CSSProperties; title: string; touch: boolean; onResize: (endHours: number) => void; onOpen: (el: HTMLElement) => void }) {
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
      onClick={(ev) => onOpen(ev.currentTarget)}
    >
      <span className="text-muted-foreground absolute top-0.5 left-1 truncate text-[10px]">{band.title}</span>
      {!touch && (
      <div
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
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
        onClick={(ev) => ev.stopPropagation()}
      />
      )}
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
  onOpen,
  touch,
  ghost,
}: {
  date: DateStr;
  from: number;
  to: number;
  entries: Entry[];
  bands: Band[];
  today: DateStr;
  nowH: number;
  touch: boolean;
  /** Where the lifted item will land, while a drag hovers this day. */
  ghost: Ghost | null;
  onOpen: (target: HoursTarget, el: HTMLElement) => void;
  onSlotClick: (date: DateStr, hours: number, point: { x: number; y: number }) => void;
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
          <BandLayer key={b.key} band={b} from={from} to={to} touch={touch} onResize={(h) => onBandResize(b, h)} onOpen={(el) => onOpen({ kind: "timed", item: b.item }, el)} />
        ))}
        {Array.from({ length: to - from }, (_, i) => (
          <div
            key={i}
            className="border-border/60 absolute right-0 left-0 border-t"
            style={{ top: i * HOUR_PX, height: HOUR_PX }}
            // A phone adds on a tap (the browser sends none after a scroll); a desk keeps the double-click.
            {...{
              [touch ? "onClick" : "onDoubleClick"]: (e: React.MouseEvent<HTMLDivElement>) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const hours = Math.min(to - SNAP_MIN / 60, snap(from + i + (e.clientY - rect.top) / HOUR_PX - SNAP_MIN / 120));
                onSlotClick(date, hours, { x: e.clientX, y: e.clientY });
              },
            }}
          />
        ))}
        {laid.map(({ item: en, col, cols }) => (
          <Block
            key={en.kind === "block" ? en.item.placementId : en.item.key}
            entry={en}
            from={from}
            col={col}
            cols={cols}
            touch={touch}
            onResize={(h) => onResize(en, h)}
            onComplete={en.kind === "block" ? () => onComplete(en.item) : undefined}
            onRemove={en.kind === "block" ? () => onRemove(en.item) : undefined}
            onOpen={(el) => onOpen(en.kind === "block" ? { kind: "work", item: en.item } : { kind: "timed", item: en.item }, el)}
          />
        ))}
        {ghost && (
          <div
            className="border-primary bg-primary/10 pointer-events-none absolute inset-x-0.5 z-[3] rounded-md border-2 border-dashed px-1.5 py-0.5"
            style={{ top: (ghost.startH - from) * HOUR_PX + 1, height: Math.max(18, ghost.lenH * HOUR_PX - 2) }}
          >
            {/* Bottom right: the lifted chip rides the top left under the finger. */}
            <span className="bg-background text-primary absolute right-1 bottom-0.5 rounded px-1 text-[11px] font-semibold tabular-nums">
              {formatTime(toClock(ghost.startH))}–{formatTime(toClock(ghost.startH + ghost.lenH))}
            </span>
          </div>
        )}
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
function PoolColumn({ items, onComplete, onOpen, collapsible }: { items: WorkItem[]; onComplete: (item: WorkItem) => void; onOpen: (target: HoursTarget, el: HTMLElement) => void; collapsible?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL });
  const [open, setOpen] = useState(false);
  const chips = items.map((w) => (
    <Chip key={w.key} id={`item:${w.key}`} data={{ item: w }} title={w.title} color={w.color} planned={w.blocksAhead} onComplete={() => onComplete(w)} work={w} onOpen={(el) => onOpen({ kind: "work", item: w }, el)} />
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
    useSensor(TouchSensor, { activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 } }),
  );
  const [active, setActive] = useState<{ title: string } | null>(null);
  const [ghost, setGhost] = useState<Ghost | null>(null);
  // A drag ends with a click on whatever it was released over: that click is not a tap.
  const lastDrag = useRef(0);
  const [editing, setEditing] = useState<(HoursEditing & { id: number }) | null>(null);
  const [adding, setAdding] = useState<AddingAt | null>(null);
  const open = (target: HoursTarget, anchor: HTMLElement) => {
    if (Date.now() - lastDrag.current < 350) return;
    // The sheet takes the lower half of a phone: bring what is being edited above it.
    if (isMobile && anchor.closest("[data-col]")) anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    setEditing({ target, anchor, id: Date.now() });
  };
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
    // The press took: a phone says so before the finger moves.
    if ("touches" in ev) navigator.vibrate?.(10);
  }
  /** The hour a drag over a day column lands on. Live rect: the grid may have auto-scrolled during the drag. */
  function landing(e: Pick<DragEndEvent, "active" | "over">): { date: DateStr; startH: number } | null {
    const overId = e.over ? String(e.over.id) : "";
    if (!overId.startsWith("col:")) return null;
    const date = overId.slice(4);
    const isBlockDrag = String(e.active.id).startsWith("block:") || String(e.active.id).startsWith("timed:");
    const colEl = document.querySelector<HTMLElement>(`[data-col="${date}"]`);
    const colTop = colEl ? colEl.getBoundingClientRect().top : e.over!.rect.top;
    const top = pointer.current.y - (isBlockDrag ? pointer.current.grab : 8) - colTop;
    return { date, startH: Math.max(from, Math.min(to - SNAP_MIN / 60, snap(from + top / HOUR_PX))) };
  }
  /** How long the lifted thing lasts, in hours; null when it lands as all-day. */
  function lengthOf(d: { item?: WorkItem; timed?: SurfaceTimedItem; template?: TimedTemplate }): number | null {
    if (d.template) return d.template.durationMin === null ? null : d.template.durationMin / 60;
    if (d.item) return d.item.start ? durationOf(d.item.start, d.item.end) : DEFAULT_MIN / 60;
    if (d.timed) return d.timed.start ? durationOf(d.timed.start, d.timed.end, 60) : 1;
    return null;
  }
  function onDragMove(e: DragMoveEvent) {
    const at = landing(e);
    const lenH = at && lengthOf(e.active.data.current as Parameters<typeof lengthOf>[0]);
    const next = at && lenH ? { ...at, lenH } : null;
    setGhost((g) => (g?.date === next?.date && g?.startH === next?.startH && g?.lenH === next?.lenH ? g : next));
  }
  function endDrag() {
    setActive(null);
    setGhost(null);
    lastDrag.current = Date.now();
  }
  function onDragEnd(e: DragEndEvent) {
    endDrag();
    if (!e.over) return;
    const overId = String(e.over.id);
    const d = e.active.data.current as { item?: WorkItem; timed?: SurfaceTimedItem; template?: TimedTemplate };
    const at = landing(e);
    if (at) {
      const { date, startH } = at;
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
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 12 }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
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
                aria-label="Add"
                onClick={() => setAdding({ date: anchor, hours: anchor === today ? Math.min(snap(nowH), to - 1) : Math.max(from, 9), point: null })}
              >
                <Plus />
              </Button>
            )}
          </div>
        </div>

        {isMobile && <DayStrip anchor={anchor} today={today} onPick={(d) => go(d)} />}

        <div className="grid min-h-0 flex-1 grid-cols-[13rem_1fr] gap-2 max-md:flex max-md:flex-col">
          <div className="flex min-h-0 flex-col gap-2 max-md:contents">
            <PoolColumn items={pool as WorkItem[]} onComplete={(w) => completeSurfaceItem(w as SurfaceItem).catch(fail)} onOpen={open} collapsible={isMobile} />
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
                return <Strip key={d} date={d} work={st.work} allDay={st.allDay} onOpen={open} onCompleteChip={(w) => completeSurfaceItem(w as SurfaceItem).then(() => toast.success(`${w.title} done`)).catch(fail)} />;
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
                      touch={isMobile}
                      ghost={ghost?.date === d ? ghost : null}
                      onOpen={open}
                      onSlotClick={(date, hours, point) => {
                        if (Date.now() - lastDrag.current < 350) return;
                        setAdding({ date, hours, point });
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
            ? "Tap anything to edit it · tap an empty hour to add · press and hold to drag."
            : "Click anything to edit it · double-click a slot to add · drag work or a template into a slot to plan it — a chip stays and can be planned again · drag a block to the strip or the pool to remove it · resize the bottom edge · shaded bands are your time blockers; one-off bands drag."}
        </p>
      </div>

      <DragOverlay dropAnimation={null}>{active && <div className="bg-card rounded-md border px-2 py-1 text-xs shadow-md">{active.title}</div>}</DragOverlay>

      {editing && (
        <HoursEditor
          key={editing.id}
          editing={editing}
          defaultDay={anchor}
          inView={(d) => days.includes(d)}
          onGo={(d) => go(d)}
          onClose={() => setEditing(null)}
        />
      )}
      {adding && <AddAtHour at={adding} templates={templates} pool={pool as (PoolItem & { color?: string })[]} onClose={() => setAdding(null)} />}
    </DndContext>
  );
}

