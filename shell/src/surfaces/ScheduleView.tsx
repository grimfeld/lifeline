import { memo, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ItemMark, missed } from "./marks";
import { DndContext, DragOverlay, MouseSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from "@dnd-kit/core";
import { Button, cn, toast, Tooltip, TooltipContent, TooltipTrigger } from "@lifeline/ui";
import {
  canPush,
  addDays,
  canRescheduleTimed,
  cutEdges,
  completeSurfaceItem,
  createFromTimedTemplate,
  formatHuman,
  formatTime,
  hourWindow,
  layoutColumns,
  momentAfter,
  moveSurfaceItem,
  moveTimedItem,
  parts,
  rescheduleTimedItem,
  scheduleSurfaceItem,
  spanEndingAt,
  spanLasting,
  NEW_TIMED_MIN,
  spanMovedTo,
  startDayMovedTo,
  startOfWeek,
  timedCreators,
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
import { CalendarClock, Check, ChevronDown, Inbox, LayoutTemplate, Plus, Trash2, Zap } from "lucide-react";
import { usePush } from "./push";
import { HoursEditor, type HoursEditing, type HoursTarget } from "./HoursEditor";
import { AddAtHour, type AddingAt } from "./AddAtHour";
import { snap, sweptRange, toClock } from "./hours";
import { DEFAULT_MIN, HOUR_PX, addHours, durationOf, entriesByDay as groupEntries, hourLabel, landingHours, lengthOf, resizedEnd, slotHours, templateLength, weekdayName, type Band, type Entry, type Ghost, type Lifted, type WorkItem } from "./scheduleGrid";
import type { CalendarCtx } from "./CalendarSurface";
import { HOURS_INSTRUCTIONS, itemKey, keepFocus, type Step } from "./itemKeys";

const NO_ENTRIES: Entry[] = [];
const NO_BANDS: Band[] = [];
const NO_STRIP: { work: WorkItem[]; allDay: SurfaceTimedItem[] } = { work: [], allDay: [] };
/** Long enough that a flick to scroll never lifts a block; short enough to feel like a press. */
const LONG_PRESS_MS = 350;
const POOL = "pool";

/** Hours since midnight, now. */
function hoursNow(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}

/** What keeps the keyboard on an item across a move (`keepFocus`): a timed item's pieces share it, whatever their day. */
const timedFocus = (t: SurfaceTimedItem) => `timed:${t.appId}/${t.itemId}`;

/** A function whose identity never changes and which always calls the latest `fn`: a handler a memoised child can take. */
function useStable<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((...args: A) => ref.current(...args), []);
}

/**
 * Where a drag will land, outside React state: a drag moves it many times a
 * second, and only the ghost in the column it enters or leaves may redraw
 * for that (#279) — never the whole Schedule.
 */
function ghostStore() {
  let ghost: Ghost | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => ghost,
    set(next: Ghost | null) {
      if (ghost?.date === next?.date && ghost?.startH === next?.startH && ghost?.lenH === next?.lenH) return;
      ghost = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => void listeners.delete(l);
    },
  };
}
type GhostStore = ReturnType<typeof ghostStore>;

/** Push (ADR 0054) on a chip or block: a small icon that must not start a drag. Nothing where Push is not offered. */
function PushIcon({ item, className }: { item: WorkItem; className?: string }) {
  const push = usePush(item);
  if (!push) return null;
  return (
    <button
      type="button"
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
function Chip({ id, focusKey, data, title, color, done, planned, onComplete, work, onOpen, onStep, late, compact }: { id: string; focusKey: string; data: Record<string, unknown>; title: string; color?: string; done?: boolean; planned?: number; onComplete?: () => void; work?: WorkItem; onOpen?: (el: HTMLElement) => void; onStep?: (step: Step) => void; late?: boolean; compact?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data });
  const scheduled = !!planned && planned > 0;
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-focus-key={focusKey}
      onKeyDown={(ev) => {
        const k = itemKey(ev, "time");
        if (k?.open) onOpen?.(ev.currentTarget);
        else if (k) onStep?.(k);
      }}
      className={cn("group bg-card flex cursor-grab items-center gap-1.5 rounded-md border px-1.5 py-1 text-xs select-none max-md:py-1.5", compact && "gap-0.5 px-0.5 text-2xs", isDragging && "opacity-40", (done || scheduled) && "opacity-60", scheduled && "border-dashed")}
      onClick={(ev) => onOpen?.(ev.currentTarget)}
      title={scheduled ? `${title} · ${planned} block${planned === 1 ? "" : "s"} planned — drag again for another` : title}
    >
      {/* Too narrow for controls (a phone's Week): the tap opens the editor, which ticks too. */}
      {onComplete && !done && !compact && (
        <button
          type="button"
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
      <span className={cn("truncate", done && "line-through", late && "text-destructive font-medium")}>
        <ItemMark mark={work?.mark} />
        {title}
      </span>
      {work && !compact && <PushIcon item={work} className="hidden group-hover:block max-md:block" />}
      {scheduled && !compact && <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">×{planned}</span>}
      {!compact && <span className={cn("size-1.5 shrink-0 rounded-full", !scheduled && "ml-auto")} style={{ background: color ?? "var(--muted-foreground)" }} />}
    </div>
  );
}

/**
 * A block on the timeline: draggable, resizable at the bottom edge. A piece
 * of a timed item that runs across days (ADR 0090) is drawn on its own day,
 * squared and labelled where it carries on. Any piece drags the whole item;
 * only the last one, where the item ends, resizes.
 */
function Block({ entry, from, cols, col, touch, onResize, onComplete, onRemove, onOpen, onStep }: { entry: Entry; from: number; cols: number; col: number; touch: boolean; onResize: (endHours: number) => void; onComplete?: () => void; onRemove?: () => void; onOpen: (el: HTMLElement) => void; onStep: (step: Step) => void }) {
  const isBlock = entry.kind === "block";
  // One item may have several blocks (ADR 0028): the Placement, not the item, is the draggable.
  const id = isBlock ? `block:${entry.item.placementId}` : `timed:${entry.item.key}`;
  const grab = useRef(0);
  const data = isBlock ? { item: entry.item, grab } : { timed: entry.item, grab };
  const cut = isBlock ? { before: null, after: null } : cutEdges(entry.item);
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
      data-focus-key={isBlock ? id : timedFocus(entry.item)}
      onKeyDown={(ev) => {
        const k = itemKey(ev, "time");
        if (k?.open) onOpen(ev.currentTarget);
        else if (k) onStep(k);
      }}
      className={cn(
        "group absolute z-[2] cursor-grab overflow-hidden rounded-md border-l-2 px-1.5 py-0.5 text-xs shadow-sm select-none",
        cut.before && "rounded-t-none",
        cut.after && "rounded-b-none",
        isDragging && "opacity-40",
        done && "opacity-60",
      )}
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
          // A 14px disc, with a hit area grown to 26px like the kit's Checkbox (WCAG 2.5.8).
          <button
            type="button"
            className="hover:bg-accent focus-visible:ring-ring/50 relative flex size-3.5 shrink-0 items-center justify-center rounded-full border outline-none after:absolute after:-inset-1.5 focus-visible:ring-3"
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
            type="button"
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
        <div className="text-muted-foreground truncate text-2xs">
          {cut.before ?? (cut.after ? formatTime(entry.start) : `${formatTime(entry.start)}–${formatTime(entry.end)}`)}
        </div>
      )}
      {cut.after && !short && <div className="text-muted-foreground absolute inset-x-1.5 bottom-0.5 truncate text-2xs">{cut.after}</div>}
      {/* On a phone the edge was a 12px target that fought the scroll: length is set in the editor there. A piece that carries on into the next day has no end of its own to drag. */}
      {!touch && !cut.after && (
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
          const next = resizedEnd(s, resizing.current.startEnd, ev.clientY - resizing.current.startY);
          (ev.currentTarget.parentElement as HTMLElement).style.height = `${Math.max(18, (next - s) * HOUR_PX - 2)}px`;
        }}
        onPointerUp={(ev) => {
          if (!resizing.current) return;
          const next = resizedEnd(s, resizing.current.startEnd, ev.clientY - resizing.current.startY);
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
const Strip = memo(function Strip({ date, work, allDay, onCompleteChip, onOpen, onStep, compact }: { date: DateStr; work: WorkItem[]; allDay: SurfaceTimedItem[]; onCompleteChip: (item: WorkItem) => void; onOpen: (target: HoursTarget, el: HTMLElement) => void; onStep: (target: HoursTarget, step: Step, focusKey: string) => void; compact?: boolean }) {
  const stripDrop = useDroppable({ id: `strip:${date}` });
  return (
    <div ref={stripDrop.setNodeRef} className={cn("min-h-12 max-h-32 space-y-1 overflow-y-auto border-l p-1 max-md:max-h-24", compact && "p-0.5", stripDrop.isOver && "bg-accent/40")}>
      {allDay.map((t) => (
        <Chip key={t.key} id={`timed:${t.key}`} focusKey={timedFocus(t)} data={{ timed: t }} title={t.title} color={t.color} late={missed(t)} compact={compact} onOpen={(el) => onOpen({ kind: "timed", item: t }, el)} onStep={(st) => onStep({ kind: "timed", item: t }, st, timedFocus(t))} />
      ))}
      {work.map((w) => (
        <Chip key={w.key} id={`item:${w.key}`} focusKey={`item:${w.key}`} data={{ item: w }} title={w.title} color={w.color} done={!!w.completedOn} planned={w.blocksAhead} onComplete={() => onCompleteChip(w)} work={w} compact={compact} onOpen={(el) => onOpen({ kind: "work", item: w }, el)} onStep={(st) => onStep({ kind: "work", item: w }, st, `item:${w.key}`)} />
      ))}
      {allDay.length === 0 && work.length === 0 && !compact && <div className="text-muted-foreground px-1 text-2xs">untimed</div>}
    </div>
  );
});

/** One Time blocker band, clipped to the visible hours. A weekly band is inert; a one-off band drags and resizes (ADR 0029). */
function BandLayer({ band, from, to, touch, onResize, onOpen, onStep }: { band: Band; from: number; to: number; touch: boolean; onResize: (endHours: number) => void; onOpen: (el: HTMLElement) => void; onStep: (step: Step) => void }) {
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
  // Nothing for an empty band, or one whose start or end is no time (NaN): a bad stored value must not paint at `top: NaN`.
  if (!(e > s)) return null;
  if (band.fixed) {
    return (
      <div className="pointer-events-none absolute inset-x-0 z-0 overflow-hidden border-y" style={style} title={title}>
        <span className="text-muted-foreground absolute top-0.5 left-1 truncate text-2xs">{band.title}</span>
      </div>
    );
  }
  return <OneOffBand band={band} s={s} e={e} style={style} title={title} touch={touch} onResize={onResize} onOpen={onOpen} onStep={onStep} />;
}

/**
 * A one-off blocker's band: still behind everything, but a draggable. One
 * that runs across days (ADR 0090) paints a band per day; any of them drags
 * the whole blocker, and only the last, where it ends, has a resize edge.
 */
function OneOffBand({ band, s, e, style, title, touch, onResize, onOpen, onStep }: { band: Band; s: number; e: number; style: React.CSSProperties; title: string; touch: boolean; onResize: (endHours: number) => void; onOpen: (el: HTMLElement) => void; onStep: (step: Step) => void }) {
  const grab = useRef(0);
  const cut = cutEdges(band.item);
  // A band clipped to the visible hours (a next-day part from 00:00) is held by its visible top; `hidden` says how far its real start is above it.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `timed:${band.item.key}`, data: { timed: band.item, grab, hidden: s - toHours(band.start) } });
  const resizing = useRef<{ startY: number; startEnd: number } | null>(null);
  const label = `${[cut.before, title, cut.after].filter(Boolean).join(" ")} · one-off, drag to move`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          {...attributes}
          {...listeners}
          className={cn("absolute inset-x-0 z-[1] cursor-grab overflow-hidden border-y select-none", isDragging && "opacity-40")}
          style={style}
          aria-label={label}
          data-focus-key={timedFocus(band.item)}
          onKeyDown={(ev) => {
            const k = itemKey(ev, "time");
            if (k?.open) onOpen(ev.currentTarget);
            else if (k) onStep(k);
          }}
          onPointerDownCapture={(ev) => {
            grab.current = ev.clientY - ev.currentTarget.getBoundingClientRect().top;
          }}
          onClick={(ev) => onOpen(ev.currentTarget)}
        >
          <span className="text-muted-foreground absolute inset-x-1 top-0.5 truncate text-2xs">{band.title}</span>
          {cut.after && (e - s) * HOUR_PX >= 34 && <span className="text-muted-foreground absolute inset-x-1 bottom-0.5 truncate text-2xs">{cut.after}</span>}
          {!touch && !cut.after && (
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
              const next = resizedEnd(s, resizing.current.startEnd, ev.clientY - resizing.current.startY);
              (ev.currentTarget.parentElement as HTMLElement).style.height = `${(next - s) * HOUR_PX}px`;
            }}
            onPointerUp={(ev) => {
              if (!resizing.current) return;
              const next = resizedEnd(s, resizing.current.startEnd, ev.clientY - resizing.current.startY);
              resizing.current = null;
              if (next !== e) onResize(next);
            }}
            onClick={(ev) => ev.stopPropagation()}
          />
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** The red line at the current time: the one part of a day that changes by the minute, so the only one the clock redraws. */
function NowLine({ from, to }: { from: number; to: number }) {
  const [nowH, setNowH] = useState(hoursNow);
  useEffect(() => {
    const id = setInterval(() => setNowH(hoursNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  if (nowH < from || nowH > to) return null;
  return (
    <div className="pointer-events-none absolute right-0 left-0 z-10 flex items-center" style={{ top: (nowH - from) * HOUR_PX }}>
      <span className="bg-destructive size-2 rounded-full" />
      <span className="bg-destructive h-px flex-1" />
    </div>
  );
}

/** A dashed box over the hours an item will take: the drag's landing, or a desk sweep's range. */
function GhostBox({ ghost, from }: { ghost: Ghost; from: number }) {
  return (
    <div
      className="border-primary bg-primary/10 pointer-events-none absolute inset-x-0.5 z-[3] rounded-md border-2 border-dashed px-1.5 py-0.5"
      style={{ top: (ghost.startH - from) * HOUR_PX + 1, height: Math.max(18, ghost.lenH * HOUR_PX - 2) }}
    >
      {/* Bottom right: the lifted chip rides the top left under the finger. */}
      <span className="bg-background text-primary absolute right-1 bottom-0.5 rounded px-1 text-xs font-semibold tabular-nums">
        {formatTime(toClock(ghost.startH))}–{formatTime(toClock(ghost.startH + ghost.lenH))}
      </span>
    </div>
  );
}

/** Where the lifted item will land, while a drag hovers this day: the store's ghost, read for this day alone. */
function DragGhost({ ghosts, date, from }: { ghosts: GhostStore; date: DateStr; from: number }) {
  const ghost = useSyncExternalStore(ghosts.subscribe, () => {
    const g = ghosts.get();
    return g?.date === date ? g : null;
  });
  return ghost && <GhostBox ghost={ghost} from={from} />;
}

const DayColumn = memo(function DayColumn({
  date,
  from,
  to,
  entries,
  bands,
  today,
  onSlotClick,
  onSweep,
  onResize,
  onBandResize,
  onComplete,
  onRemove,
  onOpen,
  onStep,
  touch,
  ghosts,
}: {
  date: DateStr;
  from: number;
  to: number;
  entries: Entry[];
  bands: Band[];
  today: DateStr;
  touch: boolean;
  /** Where a lifted item will land: read by the ghost alone, so a drag does not redraw the column. */
  ghosts: GhostStore;
  onOpen: (target: HoursTarget, el: HTMLElement) => void;
  /** An arrow key on an item: move it by the step. */
  onStep: (target: HoursTarget, step: Step, focusKey: string) => void;
  onSlotClick: (date: DateStr, hours: number, point: { x: number; y: number }) => void;
  /** A desk sweep over empty hours was let go: add across that range. */
  onSweep: (date: DateStr, startH: number, endH: number, point: { x: number; y: number }) => void;
  onResize: (entry: Entry, endHours: number) => void;
  onBandResize: (band: Band, endHours: number) => void;
  onComplete: (item: SurfaceItem) => void;
  onRemove: (item: SurfaceItem) => void;
}) {
  const colDrop = useDroppable({ id: `col:${date}` });
  const height = (to - from) * HOUR_PX;
  const laid = useMemo(() => layoutColumns(entries.map((en) => ({ ...en, start: en.start, end: en.end }))), [entries]);
  /** A desk sweep in progress (#226): where the press began, and the range drawn once the pointer has moved. */
  const pressed = useRef<{ y: number; hours: number } | null>(null);
  const [sweep, setSweep] = useState<Ghost | null>(null);
  const hoursAt = (el: HTMLElement, clientY: number) => from + (clientY - el.getBoundingClientRect().top) / HOUR_PX;
  // Only empty hours start one: Blocks and bands sit above the slots and take their own presses (a drag).
  // Mouse and pen only — on a phone a press and hold drags an item, and a tap adds.
  const sweepHandlers = touch
    ? {}
    : {
        onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
          if (e.pointerType === "touch" || e.button !== 0) return;
          const col = e.currentTarget.parentElement!;
          pressed.current = { y: e.clientY, hours: hoursAt(col, e.clientY) };
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault(); // no text selection while sweeping
        },
        onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
          const p = pressed.current;
          if (!p || (!sweep && Math.abs(e.clientY - p.y) < 4)) return;
          const r = sweptRange(p.hours, hoursAt(e.currentTarget.parentElement!, e.clientY), from, to);
          setSweep((g) => (g?.startH === r.startH && g.lenH === r.endH - r.startH ? g : { date, startH: r.startH, lenH: r.endH - r.startH }));
        },
        onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
          pressed.current = null;
          if (!sweep) return;
          setSweep(null);
          onSweep(date, sweep.startH, sweep.startH + sweep.lenH, { x: e.clientX, y: e.clientY });
        },
        onPointerCancel: () => {
          pressed.current = null;
          setSweep(null);
        },
      };
  return (
    <div className="flex min-w-0 flex-col">
      <div ref={colDrop.setNodeRef} className={cn("relative", colDrop.isOver && "bg-accent/20")} style={{ height }} data-col={date}>
        {bands.map((b) => (
          <BandLayer key={b.key} band={b} from={from} to={to} touch={touch} onResize={(h) => onBandResize(b, h)} onOpen={(el) => onOpen({ kind: "timed", item: b.item }, el)} onStep={(st) => onStep({ kind: "timed", item: b.item }, st, timedFocus(b.item))} />
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
                const hours = slotHours(from, to, i, e.clientY - rect.top);
                onSlotClick(date, hours, { x: e.clientX, y: e.clientY });
              },
            }}
            {...sweepHandlers}
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
            onStep={(st) => (en.kind === "block" ? onStep({ kind: "work", item: en.item }, st, `block:${en.item.placementId}`) : onStep({ kind: "timed", item: en.item }, st, timedFocus(en.item)))}
          />
        ))}
        {sweep ? <GhostBox ghost={sweep} from={from} /> : <DragGhost ghosts={ghosts} date={date} from={from} />}
        {date === today && <NowLine from={from} to={to} />}
      </div>
    </div>
  );
});

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
      onKeyDown={(ev) => {
        // Enter does what the bolt does (a blocker template answers that it needs an hour).
        if (itemKey(ev, "time")?.open) onAdd();
      }}
      className={cn("bg-card flex cursor-grab items-center gap-1.5 rounded-md border border-dashed px-1.5 py-1 text-xs select-none", isDragging && "opacity-40")}
      style={template.background ? { background: `repeating-linear-gradient(135deg, color-mix(in oklab, ${color} 14%, transparent) 0 6px, transparent 6px 12px)` } : undefined}
      title={template.subtitle ? `${template.title} · ${template.subtitle}` : template.title}
    >
      <span className="truncate">{template.title}</span>
      <span className="text-muted-foreground ml-auto shrink-0 tabular-nums">
        {templateLength(template.durationMin)}
      </span>
      {!template.background && (
      <button
        type="button"
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
        <button type="button" className="text-muted-foreground flex w-full items-center gap-1 px-2 py-1.5 text-xs font-medium" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
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
    <Chip key={w.key} id={`item:${w.key}`} focusKey={`item:${w.key}`} data={{ item: w }} title={w.title} color={w.color} planned={w.blocksAhead} onComplete={() => onComplete(w)} work={w} onOpen={(el) => onOpen({ kind: "work", item: w }, el)} />
  ));
  if (collapsible) {
    return (
      <div ref={setNodeRef} className={cn("shrink-0 rounded-lg border", isOver && "bg-accent/40")}>
        <button type="button" className="text-muted-foreground flex w-full items-center gap-1 px-2 py-1.5 text-xs font-medium" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
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
    <div className="flex shrink-0 basis-full gap-1">
      {week.map((d) => {
        const active = d === anchor;
        return (
          <button
            type="button"
            key={d}
            onClick={() => onPick(d)}
            aria-current={active ? "date" : undefined}
            className={cn(
              "flex flex-1 flex-col items-center rounded-md border py-1 text-2xs leading-tight",
              active ? "bg-primary text-primary-foreground border-primary" : d === today ? "text-primary" : "text-muted-foreground",
            )}
          >
            {weekdayName(d)}
            <span className="text-sm font-medium tabular-nums">{parts(d).day}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * The Schedule (ADR 0015, ADR 0063): the Calendar's hour-scaled views — Day,
 * 3 Day and Week. Chips (strip or pool) are sources: drag one onto a slot to make a Time block and the chip
 * stays, greyed while blocks lie ahead (ADR 0028); drag a block to move that
 * block alone; drag it to the strip or the pool to remove it. Resize the
 * bottom edge; double-click an empty slot, or sweep down empty hours on the desk, to add an Event. Times live in
 * Placements; Events and one-off blockers (ADR 0029) retime through their App.
 */
export function ScheduleView({ ctx }: { ctx: CalendarCtx }) {
  const { view, anchor, today, days, tags, isMobile, go } = ctx;
  const first = days[0] ?? anchor;
  const last = days.at(-1) ?? first;
  const items = useSurfaceItems({ start: first, end: last }, { tags });
  const pool = usePoolItems({ tags });
  const allTimed = useTimedItems({ start: first, end: last }, { tags });
  // Time blockers arrive through the Timed contract as background items (ADR 0027): bands, not things.
  const timed = useMemo(() => allTimed.filter((t) => !t.background), [allTimed]);
  const bandItems = useMemo(() => allTimed.filter((t) => t.background && t.start), [allTimed]);
  const templates = useTimedTemplates();
  const creator = timedCreators()[0];

  // The read hooks hand out stable arrays while nothing changed, so these
  // memos hit and a day column's layout is not redone on every render.
  const timedIn = useMemo(() => timed.filter((t) => t.start), [timed]);
  const blocks = useMemo(() => items.filter((i) => i.start), [items]);
  const { from, to } = useMemo(() => hourWindow([...timedIn, ...blocks.map((b) => ({ start: b.start!, end: b.end ?? null }))], 7, 23), [timedIn, blocks]);

  const entriesByDay = useMemo(() => groupEntries(blocks, timedIn), [blocks, timedIn]);
  // Grouped by day once per change, not filtered per day per render: each column's props stay the same arrays while nothing moved.
  const bandsByDay = useMemo(() => {
    const out = new Map<DateStr, Band[]>();
    for (const b of bandItems) {
      const band: Band = { key: b.key, title: b.title, start: b.start!, end: b.end ?? "24:00", color: b.color, fixed: !!b.fixed, item: b };
      const list = out.get(b.date);
      if (list) list.push(band);
      else out.set(b.date, [band]);
    }
    return out;
  }, [bandItems]);
  const stripByDay = useMemo(() => {
    const out = new Map<DateStr, { work: WorkItem[]; allDay: SurfaceTimedItem[] }>();
    const of = (d: DateStr) => out.get(d) ?? out.set(d, { work: [], allDay: [] }).get(d)!;
    for (const i of items) if (!i.start) of(i.displayDate).work.push(i as WorkItem);
    for (const t of timed) if (!t.start) of(t.date).allDay.push(t);
    return out;
  }, [items, timed]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 } }),
  );
  const [active, setActive] = useState<{ title: string } | null>(null);
  const [ghosts] = useState(ghostStore);
  // A drag ends with a click on whatever it was released over: that click is not a tap.
  const lastDrag = useRef(0);
  const [editing, setEditing] = useState<(HoursEditing & { id: number }) | null>(null);
  const [adding, setAdding] = useState<AddingAt | null>(null);
  const open = useStable((target: HoursTarget, anchor: HTMLElement) => {
    if (Date.now() - lastDrag.current < 350) return;
    // The sheet takes the lower half of a phone: bring what is being edited above it.
    if (isMobile && anchor.closest("[data-col]")) anchor.scrollIntoView({ block: "start", behavior: "smooth" });
    setEditing({ target, anchor, id: Date.now() });
  });
  const pointer = useRef<{ y: number; grab: number }>({ y: 0, grab: 0 });
  const scroller = useRef<HTMLDivElement>(null);
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || !scroller.current) return;
    didScroll.current = true;
    scroller.current.scrollTop = Math.max(0, (Math.min(hoursNow(), 23) - from - 1) * HOUR_PX);
  }, [from]);

  const fail = (err: Error) => toast.error(`Could not save: ${err.message}`);

  /**
   * An arrow key on an item (#284): the keyboard's drag. A block or a timed
   * item moves by the step and keeps its length; a chip only by the day, as
   * a drop on that day's strip would; a pool chip has no day to step from.
   */
  const step = useStable((target: HoursTarget, st: Step, focusKey: string) => {
    let write: Promise<void> | undefined;
    let date: DateStr | undefined;
    if (target.kind === "work") {
      const it = target.item as WorkItem;
      if (!it.displayDate) return;
      date = addDays(it.displayDate, st.days);
      if (it.start) {
        const len = durationOf(it.start, it.end);
        const startH = Math.max(0, Math.min(24 - len, toHours(it.start) + st.minutes / 60));
        write = scheduleSurfaceItem(it as SurfaceItem, date, { start: toClock(startH), end: toClock(startH + len) });
      } else if (st.days) write = scheduleSurfaceItem(it as SurfaceItem, date, null);
    } else {
      const t = target.item;
      if (t.start) {
        if (!canRescheduleTimed(t.appId)) return void toast.error("This item can't be retimed here");
        const at = momentAfter(addDays(t.date, st.days), t.start, st.minutes);
        date = at.date;
        write = rescheduleTimedItem(t, spanMovedTo(t, at.date, at.time));
      } else if (st.days) {
        date = addDays(t.date, st.days);
        write = canRescheduleTimed(t.appId) ? rescheduleTimedItem(t, { date: startDayMovedTo(t, date), start: null, end: null }) : moveTimedItem(t, date);
      }
    }
    if (!write || !date) return;
    const landed = date;
    keepFocus(focusKey);
    // Off the days on screen, the item is gone from under the keyboard: say where it went.
    write.then(() => void (!days.includes(landed) && toast.success(`Moved to ${formatHuman(landed)}`))).catch(fail);
  });
  const slotClick = useStable((date: DateStr, hours: number, point: { x: number; y: number }) => {
    if (Date.now() - lastDrag.current < 350) return;
    setAdding({ date, hours, point });
  });
  const sweep = useStable((date: DateStr, hours: number, endHours: number, point: { x: number; y: number }) => setAdding({ date, hours, endHours, point }));
  const resize = useStable((en: Entry, endH: number) => {
    const end = toClock(endH);
    if (en.kind === "block") scheduleSurfaceItem(en.item, en.item.displayDate, { start: en.start, end }).catch(fail);
    else if (canRescheduleTimed(en.item.appId)) rescheduleTimedItem(en.item, spanEndingAt(en.item, end)).catch(fail);
  });
  const bandResize = useStable((b: Band, endH: number) => {
    // Only the last band has an edge, and it moves the end alone (ADR 0090).
    if (canRescheduleTimed(b.item.appId)) rescheduleTimedItem(b.item, spanEndingAt(b.item, toClock(endH))).catch(fail);
  });
  const complete = useStable((it: SurfaceItem) => void completeSurfaceItem(it).then(() => toast.success(`${it.title} done`)).catch(fail));
  const completeChip = useStable((w: WorkItem) => void completeSurfaceItem(w as SurfaceItem).then(() => toast.success(`${w.title} done`)).catch(fail));
  const remove = useStable((it: SurfaceItem) => void (it.placementId && unplaceItem(it.placementId).catch(fail)));

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
    return { date, startH: landingHours(top, from, to) };
  }
  function onDragMove(e: DragMoveEvent) {
    const at = landing(e);
    const lenH = at && lengthOf(e.active.data.current as Lifted);
    const next = at && lenH ? { ...at, lenH } : null;
    ghosts.set(next);
  }
  function endDrag() {
    setActive(null);
    ghosts.set(null);
    lastDrag.current = Date.now();
  }
  function onDragEnd(e: DragEndEvent) {
    endDrag();
    if (!e.over) return;
    const overId = String(e.over.id);
    const d = e.active.data.current as { item?: WorkItem; timed?: SurfaceTimedItem; template?: TimedTemplate; hidden?: number };
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
        if (!d.timed.start) {
          // An all-day item lifted onto the hours lasts an hour, past midnight when dropped late (ADR 0090).
          rescheduleTimedItem(d.timed, spanLasting(date, start, NEW_TIMED_MIN)).catch(fail);
          return;
        }
        // Whichever piece was lifted, the whole item moves by the drop (ADR 0090); one with no end stays end-less.
        rescheduleTimedItem(d.timed, spanMovedTo(d.timed, date, d.hidden ? toClock(startH - d.hidden) : start)).catch(fail);
      }
      return;
    }
    if (overId.startsWith("strip:")) {
      const date = overId.slice(6);
      if (d.item) scheduleSurfaceItem(d.item as SurfaceItem, date, null).catch(fail);
      else if (d.timed) {
        if (canRescheduleTimed(d.timed.appId)) rescheduleTimedItem(d.timed, { date: startDayMovedTo(d.timed, date), start: null, end: null }).catch(fail);
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      accessibility={{ screenReaderInstructions: { draggable: HOURS_INSTRUCTIONS } }}
      autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 12 }}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <div className="flex h-full flex-col gap-3 p-4 max-md:gap-2 max-md:p-3">
        {ctx.header(
          creator?.create && (
            <Button
              size="icon"
              variant="outline"
              className="md:hidden"
              aria-label="Add"
              onClick={() => setAdding({ date: anchor, hours: anchor === today ? Math.min(snap(hoursNow()), to - 1) : Math.max(from, 9), point: null })}
            >
              <Plus />
            </Button>
          ),
          isMobile && view === "day" && <DayStrip anchor={anchor} today={today} onPick={(d) => go(d)} />,
        )}

        <div className="grid min-h-0 flex-1 grid-cols-[13rem_1fr] gap-2 max-md:flex max-md:flex-col">
          <div className="flex min-h-0 flex-col gap-2 max-md:contents">
            <PoolColumn items={pool as WorkItem[]} onComplete={(w) => completeSurfaceItem(w as SurfaceItem).catch(fail)} onOpen={open} collapsible={isMobile} />
            <TemplatePalette templates={templates} onAdd={addTemplate} collapsible={isMobile} />
          </div>
          <div className="flex min-h-0 min-w-0 flex-col rounded-lg border max-md:flex-1">
            <div className={cn("grid shrink-0 border-b", view === "day" && "max-md:hidden")} style={{ gridTemplateColumns: `${gutter} repeat(${days.length}, minmax(0, 1fr))` }}>
              <div />
              {days.map((d) => (
                <button
                  type="button"
                  key={d}
                  className={cn("hover:bg-accent/40 border-l px-2 py-1 text-left text-xs max-md:px-0.5 max-md:text-center max-md:text-2xs", d === today && "text-primary font-semibold")}
                  onClick={() => view !== "day" && ctx.openDay(d)}
                  title={view !== "day" ? `Open ${formatHuman(d)}` : undefined}
                >
                  {weekdayName(d)}{" "}
                  <span className="text-muted-foreground max-md:block">{parts(d).day}</span>
                </button>
              ))}
            </div>
            <div className="grid shrink-0 border-b" style={{ gridTemplateColumns: `${gutter} repeat(${days.length}, minmax(0, 1fr))` }}>
              <div className="text-muted-foreground px-1 pt-1 text-2xs">all day</div>
              {days.map((d) => {
                const st = stripByDay.get(d) ?? NO_STRIP;
                return <Strip key={d} date={d} work={st.work} allDay={st.allDay} compact={isMobile && view === "week"} onOpen={open} onStep={step} onCompleteChip={completeChip} />;
              })}
            </div>
            <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid" style={{ gridTemplateColumns: `${gutter} repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="relative">
                  <div className="relative" style={{ height: (to - from) * HOUR_PX }}>
                    {Array.from({ length: to - from }, (_, i) => (
                      <div key={i} className="text-muted-foreground absolute right-1 -translate-y-1.5 text-2xs tabular-nums" style={{ top: i * HOUR_PX }}>
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
                      entries={entriesByDay.get(d) ?? NO_ENTRIES}
                      bands={bandsByDay.get(d) ?? NO_BANDS}
                      today={today}
                      touch={isMobile}
                      ghosts={ghosts}
                      onOpen={open}
                      onStep={step}
                      onSlotClick={slotClick}
                      onSweep={sweep}
                      onResize={resize}
                      onBandResize={bandResize}
                      onComplete={complete}
                      onRemove={remove}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <p className="text-muted-foreground shrink-0 text-xs">
          {isMobile
            ? "Tap anything to edit it · tap an empty hour to add · press and hold to drag."
            : "Click anything to edit it · double-click a slot or drag down empty hours to add · drag work or a template into a slot to plan it — a chip stays and can be planned again · drag a block to the strip or the pool to remove it · resize the bottom edge · shaded bands are your time blockers; one-off bands drag · on the keyboard, Enter opens an item and the arrow keys move it."}
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

