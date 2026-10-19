import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { Button, cn, Input, Popover, PopoverAnchor, PopoverContent, Sheet, SheetContent, SheetTitle, toast } from "@lifeline/ui";
import {
  addDays,
  addTimeBlock,
  BLOCK_DEFAULT_MIN,
  canRemoveTimed,
  canRenameTimed,
  canRescheduleTimed,
  completeSurfaceItem,
  formatHuman,
  formatTime,
  moveTimeBlock,
  removeTimeBlock,
  removeTimedItem,
  renameTimedItem,
  rescheduleTimedItem,
  schedulableHref,
  timedHref,
  todayStr,
  toHours,
  unplaceItem,
  useIsMobile,
  type DateStr,
  type SchedulableItem,
  type SurfaceTimedItem,
} from "@lifeline/core";
import { Check, ExternalLink, Minus, Plus, Trash2 } from "lucide-react";
import { usePush } from "./push";
import { addMinutes, formatLength, minutesBetween, SNAP_MIN, toClock } from "./hours";

/** A work item as the hours show it: a Time block (placement + start) or an untimed chip. */
export type WorkLike = Pick<SchedulableItem, "appId" | "itemId" | "title" | "date" | "completedOn" | "estimateMin"> & {
  color?: string;
  displayDate?: DateStr;
  placementId?: string;
  start?: string | null;
  end?: string | null;
};

/**
 * What was tapped on the hours. A work item that is a block edits that block;
 * an untimed chip is a source (ADR 0028), so giving it a time makes a new
 * block and the chip stays. A Timed item is an Event or a one-off Time
 * blocker, retimed and removed through its App (ADR 0056).
 */
export type HoursTarget = { kind: "work"; item: WorkLike } | { kind: "timed"; item: SurfaceTimedItem };

export interface HoursEditing {
  target: HoursTarget;
  /** What was tapped: the desktop popover sits beside it. */
  anchor: HTMLElement | null;
}

const LENGTHS = [15, 30, 45, 60, 90, 120];
/** Push is a work item's; a Timed item asks for it with this and is refused. */
const NO_PUSH = { appId: "", itemId: "", title: "", date: null, completedOn: "n/a" };
export const TOAST_ID = "hours";

function isBlock(item: WorkLike): boolean {
  return !!item.placementId && !!item.start;
}

/** Anchors the popover to an element that may re-render away: keep its last box. */
function useVirtualAnchor(el: HTMLElement | null) {
  return useMemo(() => {
    let last = el?.getBoundingClientRect() ?? new DOMRect(window.innerWidth / 2, window.innerHeight / 3, 0, 0);
    return {
      current: {
        getBoundingClientRect: () => {
          if (el?.isConnected) last = el.getBoundingClientRect();
          return last;
        },
      },
    };
  }, [el]);
}

/**
 * The one editor for anything on the hours (CONTEXT.md — Schedule): a bottom
 * sheet on a phone, a popover beside the item at a desk. Every change is
 * written at once; closing leaves one Undo that puts back whatever the item
 * was when the editor opened (ADR 0056). Removal acts at once and brings its
 * own Undo. A done item's block is record: it can be removed, never retimed.
 */
export function HoursEditor({
  editing,
  defaultDay,
  inView,
  onGo,
  onClose,
}: {
  editing: HoursEditing;
  /** The day an untimed pool chip's new block lands on. */
  defaultDay: DateStr;
  /** Whether a day is on screen: moving the item off it closes the editor. */
  inView: (d: DateStr) => boolean;
  /** Show another day (the moved-to toast's Go). */
  onGo: (d: DateStr) => void;
  onClose: () => void;
}) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { target } = editing;
  // A new visit supersedes the last one's Undo (only the newest is live) — and on a phone its toast would cover the sheet.
  useEffect(() => {
    if (isMobile) toast.dismiss(TOAST_ID);
  }, [isMobile]);
  const virtual = useVirtualAnchor(editing.anchor);

  const initial = useMemo(() => {
    if (target.kind === "timed") {
      const t = target.item;
      return { date: t.date, start: t.start, len: t.start ? minutesBetween(t.start, t.end, 60) : 60 };
    }
    const w = target.item;
    if (isBlock(w)) return { date: w.displayDate ?? w.date ?? defaultDay, start: w.start!, len: minutesBetween(w.start!, w.end, BLOCK_DEFAULT_MIN) };
    return { date: w.displayDate ?? defaultDay, start: null as string | null, len: w.estimateMin && w.estimateMin > 0 ? w.estimateMin : BLOCK_DEFAULT_MIN };
    // The editor is keyed per target: the snapshot is taken once, when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [date, setDate] = useState<DateStr>(initial.date);
  const [start, setStart] = useState<string | null>(initial.start);
  const [len, setLen] = useState(initial.len);
  const [customLen, setCustomLen] = useState(!LENGTHS.includes(initial.len));
  const [title, setTitle] = useState(target.item.title);

  const blockId = useRef<string | null>(target.kind === "work" && isBlock(target.item) ? target.item.placementId! : null);
  const [hasBlock, setHasBlock] = useState(blockId.current !== null);
  const created = useRef(false);
  const changed = useRef(false);
  const renamed = useRef(false);
  /** The title last written, so a blur and then a close do not rename twice. */
  const savedTitle = useRef(target.item.title);
  const ended = useRef(false);
  // Writes run in order: a quick second nudge must not race the block the first one made.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err));
  const run = (f: () => Promise<unknown>) => {
    queue.current = queue.current.then(() => f()).then(
      () => undefined,
      (e) => void fail(e),
    );
  };

  const work = target.kind === "work" ? target.item : null;
  const timed = target.kind === "timed" ? target.item : null;
  const push = usePush(work ?? NO_PUSH);
  const readOnly = work ? !!work.completedOn : !canRescheduleTimed(timed!.appId);
  const href = work ? schedulableHref(work) : timedHref(timed!);

  function write(next: { date: DateStr; start: string | null; len: number }) {
    setDate(next.date);
    setStart(next.start);
    setLen(next.len);
    if (work) {
      // An untimed chip only chooses where its block will land until it has a start.
      if (!next.start) return;
      const time = { start: next.start, end: addMinutes(next.start, next.len) };
      changed.current = true;
      run(async () => {
        if (blockId.current) await moveTimeBlock(blockId.current, next.date, time);
        else {
          blockId.current = await addTimeBlock(work.appId, work.itemId, next.date, time);
          created.current = true;
          setHasBlock(true);
        }
      });
    } else if (timed) {
      changed.current = true;
      run(() => rescheduleTimedItem(timed, next.date, next.start, next.start ? addMinutes(next.start, next.len) : null));
    }
    // Moved off the screen: the item has left the view, so the editor goes with it.
    if (next.date !== date && !inView(next.date)) finish(next.date);
  }

  /** Close, leaving one Undo for the whole visit when anything changed. */
  function finish(finalDate = date) {
    if (ended.current) return;
    // Escape or a click outside unmounts the title field without a blur: keep what was typed.
    commitTitle();
    ended.current = true;
    onClose();
    if (!changed.current && !renamed.current) return;
    const undo = async () => {
      await queue.current;
      try {
        if (work) {
          if (created.current && blockId.current) await unplaceItem(blockId.current);
          else if (blockId.current && initial.start) await moveTimeBlock(blockId.current, initial.date, { start: initial.start, end: addMinutes(initial.start, initial.len) });
        } else if (timed) {
          if (changed.current) await rescheduleTimedItem(timed, initial.date, initial.start, initial.start ? addMinutes(initial.start, initial.len) : null);
          if (renamed.current) await renameTimedItem(timed, timed.title);
        }
      } catch (e) {
        fail(e);
      }
    };
    const moved = finalDate !== initial.date && !inView(finalDate);
    toast.success(moved ? `Moved to ${formatHuman(finalDate)}` : `${title || target.item.title} updated`, {
      id: TOAST_ID,
      action: { label: "Undo", onClick: () => void undo() },
      ...(moved ? { cancel: { label: "Go", onClick: () => onGo(finalDate) } } : {}),
    });
  }

  /** Remove at once, with its own Undo; the visit's edits stay as they are. */
  function removeNow() {
    const what = work ? "Block removed — the task stays" : `${target.item.title} deleted`;
    ended.current = true;
    onClose();
    run(async () => {
      const undo = work ? await removeTimeBlock(blockId.current!) : await removeTimedItem(timed!);
      toast.success(what, { id: TOAST_ID, action: { label: "Undo", onClick: () => void undo().catch(fail) } });
    });
  }

  function completeNow() {
    if (!work) return;
    ended.current = true;
    onClose();
    run(async () => {
      await completeSurfaceItem(work);
      toast.success(`${work.title} done`, { id: TOAST_ID });
    });
  }

  function commitTitle() {
    const next = title.trim();
    if (!timed || ended.current || !next || next === savedTitle.current) return;
    savedTitle.current = next;
    renamed.current = true;
    run(() => renameTimedItem(timed, next));
  }

  const maxStartH = 24 - len / 60;
  const nudge = (min: number) => {
    if (!start) return;
    const h = Math.max(0, Math.min(maxStartH, toHours(start) + min / 60));
    write({ date, start: toClock(h), len });
  };
  const setLength = (min: number) => {
    const safe = Math.max(SNAP_MIN, Math.min(24 * 60, Math.round(min)));
    write({ date, start, len: safe });
  };
  const tomorrow = addDays(todayStr(), 1);
  const removable = work ? hasBlock : canRemoveTimed(timed!);
  const canAllDay = !!timed && !timed.background && !readOnly;

  const color = target.item.color ?? "var(--muted-foreground)";
  const header = (
    <div className="flex items-center gap-2">
      {work && !work.completedOn && (
        <button className="hover:bg-accent flex size-6 shrink-0 items-center justify-center rounded-full border" onClick={completeNow} aria-label={`Complete ${work.title}`} title="Complete">
          <Check className="size-3.5" />
        </button>
      )}
      {work?.completedOn && <Check className="text-muted-foreground size-4 shrink-0" />}
      {!work && <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />}
      {timed && canRenameTimed(timed) ? (
        <Input
          value={title}
          aria-label="Title"
          className="h-8 font-medium"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
        />
      ) : (
        <span className={cn("min-w-0 flex-1 truncate font-medium", work?.completedOn && "line-through")}>{target.item.title}</span>
      )}
    </div>
  );

  const body: ReactNode = readOnly ? (
    <p className="text-muted-foreground text-sm">
      {formatHuman(date)}
      {start ? ` · ${formatTime(start)}–${formatTime(addMinutes(start, len))}` : " · all day"}
      {work?.completedOn ? " · done, kept as record" : ""}
    </p>
  ) : (
    <div className="grid gap-3">
      <Row label="Day">
        <Input type="date" className="h-9 w-40" value={date} onChange={(e) => e.target.value && write({ date: e.target.value, start, len })} aria-label="Day" />
        {date !== tomorrow && (
          <Chip onClick={() => write({ date: tomorrow, start, len })}>Tomorrow</Chip>
        )}
        <Chip onClick={() => write({ date: addDays(date, 1), start, len })}>+1 day</Chip>
      </Row>
      <Row label="Start">
        <Button size="icon" variant="outline" className="size-9" disabled={!start} onClick={() => nudge(-SNAP_MIN)} aria-label="15 minutes earlier">
          <Minus />
        </Button>
        <Input
          type="time"
          step={SNAP_MIN * 60}
          className="h-9 w-28"
          value={start ?? ""}
          onChange={(e) => e.target.value && write({ date, start: e.target.value, len })}
          aria-label="Start"
        />
        <Button size="icon" variant="outline" className="size-9" disabled={!start} onClick={() => nudge(SNAP_MIN)} aria-label="15 minutes later">
          <Plus />
        </Button>
        {canAllDay && (
          <Chip active={!start} onClick={() => start && write({ date, start: null, len })}>
            All day
          </Chip>
        )}
      </Row>
      {start && (
        <Row label="Length">
          {LENGTHS.map((m) => (
            <Chip key={m} active={!customLen && len === m} onClick={() => (setCustomLen(false), setLength(m))}>
              {formatLength(m)}
            </Chip>
          ))}
          {customLen ? (
            <Input
              type="number"
              inputMode="numeric"
              min={SNAP_MIN}
              step={5}
              className="h-8 w-20"
              defaultValue={len}
              aria-label="Length in minutes"
              onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== len && setLength(Number(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            />
          ) : (
            <Chip onClick={() => setCustomLen(true)}>…</Chip>
          )}
          <span className="text-muted-foreground text-xs tabular-nums">ends {formatTime(addMinutes(start, len))}</span>
        </Row>
      )}
      {!start && work && <p className="text-muted-foreground text-xs">Pick a start to plan a block — the task stays where it is.</p>}
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      {push && !readOnly && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            finish();
            push();
          }}
        >
          Push
        </Button>
      )}
      {href && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            finish();
            navigate(href);
          }}
        >
          <ExternalLink /> Open {work ? "task" : timed?.background ? "blocker" : "event"}
        </Button>
      )}
      {removable && (
        <Button variant="ghost" size="sm" className="text-destructive ml-auto" onClick={removeNow}>
          <Trash2 /> {work ? "Remove block" : timed?.background ? "Delete blocker" : "Delete event"}
        </Button>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open onOpenChange={(o) => !o && finish()}>
        <SheetContent side="bottom" className="gap-4 px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))]" aria-describedby={undefined} onOpenAutoFocus={(e) => e.preventDefault()}>
          <span className="bg-muted-foreground/30 mx-auto h-1 w-10 shrink-0 rounded-full" aria-hidden />
          <SheetTitle className="sr-only">Edit {target.item.title}</SheetTitle>
          {header}
          {body}
          {actions}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open onOpenChange={(o) => !o && finish()}>
      <PopoverAnchor virtualRef={virtual} />
      <PopoverContent side="right" align="start" className="grid w-[22rem] gap-3">
        {header}
        {body}
        {actions}
      </PopoverContent>
    </Popover>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-1">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-8 rounded-md border px-2.5 text-xs font-medium tabular-nums",
        active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent text-foreground",
      )}
    >
      {children}
    </button>
  );
}
