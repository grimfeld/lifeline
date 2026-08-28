import { useState, type ReactNode } from "react";
import { TagFilterBar } from "../components/TagFilterBar";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Badge,
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  toast,
} from "@lifeline/ui";
import {
  addDays,
  appById,
  canUnplace,
  completeSurfaceItem,
  formatHuman,
  moveSurfaceItem,
  parts,
  startOfWeek,
  todayStr,
  unplaceItem,
  usePoolItems,
  useSurfaceItems,
  useTimedItems,
  composeTagFilter,
  canMoveTimed,
  moveTimedItem,
  formatTime,
  useIsMobile,
  type DateStr,
  type PoolItem,
  type SurfaceItem,
  type SurfaceTimedItem,
} from "@lifeline/core";
import { Check, ChevronDown, ChevronLeft, ChevronRight, GripVertical, Inbox, MapPin, Pin, PinOff } from "lucide-react";

const POOL = "pool";
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Either a placed item (on a day) or a pool item (unplaced). */
type Item = (SurfaceItem | (PoolItem & { displayDate?: undefined; placementId?: undefined })) & {
  color?: string;
};

function weekLabel(start: DateStr): string {
  const end = addDays(start, 6);
  const a = parts(start);
  const b = parts(end);
  const fmt = (d: DateStr, withYear: boolean) =>
    new Date(Date.UTC(parts(d).y, parts(d).m - 1, parts(d).day)).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: withYear ? "numeric" : undefined,
      timeZone: "UTC",
    });
  if (a.y !== b.y) return `${fmt(start, true)} – ${fmt(end, true)}`;
  if (a.m !== b.m) return `${fmt(start, false)} – ${fmt(end, true)}`;
  return `${fmt(start, false)} – ${b.day}, ${b.y}`;
}

function ItemCard({
  item,
  onMove,
  dragging,
}: {
  item: Item;
  onMove: (i: Item) => void;
  dragging?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.key,
    data: { item },
    disabled: !!item.completedOn,
  });
  const done = !!item.completedOn;
  const canPool = canUnplace(item.appId);
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "bg-card group flex items-start gap-2 rounded-md border px-2 py-1.5 text-sm shadow-xs",
        !done && "cursor-grab active:cursor-grabbing",
        (isDragging || dragging) && "opacity-40",
        done && "opacity-60",
        item.urgency === "overdue" && !done && "border-destructive/50",
      )}
    >
      <button
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          done ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
        )}
        title={done ? "Done" : "Complete"}
        disabled={done}
        onPointerDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          void completeSurfaceItem(item);
          toast.success(`${item.title} done`);
        }}
      >
        {done && <Check className="size-3" />}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="min-w-0 flex-1 text-left"
            onPointerDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <span className={cn("block truncate leading-tight", done && "line-through")}>
              {item.title}
            </span>
            {item.subtitle && (
              <span className="text-muted-foreground block truncate text-xs">{item.subtitle}</span>
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <div className="text-muted-foreground px-2 py-1 text-xs">
            {appById(item.appId)?.title}
            {item.urgency === "overdue" && !done ? " · overdue" : ""}
          </div>
          {!done && (
            <DropdownMenuItem
              onClick={() => {
                void completeSurfaceItem(item);
                toast.success(`${item.title} done`);
              }}
            >
              <Check /> Complete
            </DropdownMenuItem>
          )}
          {!done && (
            <DropdownMenuItem onClick={() => onMove(item)}>
              <MapPin /> Move to day…
            </DropdownMenuItem>
          )}
          {!done && canPool && item.displayDate !== undefined && (
            <DropdownMenuItem
              onClick={() =>
                moveSurfaceItem(item, null)
                  .then(() => toast.success("Back to the pool"))
                  .catch((err: Error) => toast.error(err.message))
              }
            >
              <Inbox /> Unplace
            </DropdownMenuItem>
          )}
          {item.placementId && (
            <DropdownMenuItem
              onClick={() => {
                void unplaceItem(item.placementId!);
                toast.success("Pin removed — back to its natural day");
              }}
            >
              <PinOff /> Unpin
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <span
        className="mt-1.5 size-2 shrink-0 rounded-full"
        style={{ background: item.color ?? "var(--muted-foreground)" }}
        title={appById(item.appId)?.title}
      />
      {item.placementId && <Pin className="text-muted-foreground mt-1 size-3 shrink-0" />}
      {/* Phone: the title opens the menu, so the long-press drag needs its own
          hit area — the card is the draggable, this is the visible grip. */}
      {!done && (
        <span className="text-muted-foreground/50 -my-1.5 -mr-1 flex w-6 shrink-0 items-center justify-center self-stretch md:hidden" aria-hidden>
          <GripVertical className="size-4" />
        </span>
      )}
    </div>
  );
}

/** A fixed-time item (Event): shown above the day's work; draggable to another day when its App allows. */
function TimedCard({ item }: { item: SurfaceTimedItem }) {
  const movable = canMoveTimed(item.appId);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `timed:${item.key}`,
    data: { timed: item },
    disabled: !movable,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        "flex items-center gap-1.5 rounded-md border-l-2 bg-muted/60 px-2 py-1 text-xs",
        movable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-40",
      )}
      style={{ borderLeftColor: item.color ?? "var(--muted-foreground)" }}
      title={`${appById(item.appId)?.title} · ${item.subtitle ?? item.title}`}
    >
      {item.start ? (
        <span className="text-muted-foreground shrink-0">{formatTime(item.start)}</span>
      ) : (
        <span className="text-muted-foreground shrink-0">All day</span>
      )}
      <span className="truncate font-medium">{item.title}</span>
    </div>
  );
}

function Column({
  id,
  title,
  subtitle,
  items,
  timed = [],
  onMove,
  highlight,
  className,
  stacked,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  items: Item[];
  timed?: SurfaceTimedItem[];
  onMove: (i: Item) => void;
  highlight?: boolean;
  className?: string;
  /** Phone: a row in the day stack — height follows its contents, the page scrolls. */
  stacked?: boolean;
  children?: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "bg-background flex min-w-0 flex-col rounded-lg border",
        stacked ? "shrink-0" : "min-h-0",
        isOver && "ring-ring/50 bg-accent/30 ring-2",
        highlight && "border-primary",
        className,
      )}
    >
      <div className="flex items-baseline gap-2 border-b px-2 py-1.5">
        <span className={cn("text-sm font-medium", highlight && "text-primary")}>{title}</span>
        {subtitle && <span className="text-muted-foreground text-xs">{subtitle}</span>}
        <span className="text-muted-foreground ml-auto text-xs">
          {items.filter((i) => !i.completedOn).length || ""}
        </span>
      </div>
      <div
        className={cn(
          "flex flex-col gap-1.5 p-1.5",
          stacked ? "min-h-10" : "min-h-0 flex-1 overflow-y-auto",
        )}
      >
        {children}
        {timed.map((t) => (
          <TimedCard key={t.key} item={t} />
        ))}
        {items.map((item) => (
          <ItemCard key={item.key} item={item} onMove={onMove} />
        ))}
        {items.length === 0 && timed.length === 0 && !children && (
          <div
            className={cn(
              "text-muted-foreground/60 flex flex-1 items-center justify-center text-xs",
              stacked ? "py-1" : "py-6",
            )}
          >
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The Unplaced pool on a phone (ADR 0021's "parity grows page-by-page"): the
 * same droppable as the desktop column, collapsed above the days — which need
 * the whole width. Overdue work rides inside it, counted on the header so it
 * is visible while closed; a drop on the closed header still unplaces.
 */
function PoolDrawer({
  items,
  overdue,
  onMove,
}: {
  items: Item[];
  overdue: Item[];
  onMove: (i: Item) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: POOL });
  const [open, setOpen] = useState(false);
  return (
    <div
      ref={setNodeRef}
      className={cn("bg-background shrink-0 rounded-lg border", isOver && "ring-ring/50 bg-accent/30 ring-2")}
    >
      <button
        className="text-muted-foreground flex w-full items-center gap-1.5 px-2 py-2 text-xs font-medium"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Inbox className="size-3.5" /> Unplaced
        <span className="tabular-nums">{items.length}</span>
        {overdue.length > 0 && (
          <span className="text-destructive tabular-nums">· {overdue.length} overdue</span>
        )}
        <ChevronDown className={cn("ml-auto size-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="flex max-h-64 flex-col gap-1.5 overflow-y-auto border-t p-1.5">
          {overdue.length > 0 && (
            <>
              <div className="text-destructive px-0.5 text-xs font-medium">
                Overdue ({overdue.length})
              </div>
              {overdue.map((item) => (
                <ItemCard key={item.key} item={item} onMove={onMove} />
              ))}
              <div className="bg-border my-1 h-px" />
            </>
          )}
          {items.map((item) => (
            <ItemCard key={item.key} item={item} onMove={onMove} />
          ))}
          {items.length === 0 && overdue.length === 0 && (
            <div className="text-muted-foreground p-2 text-xs">Nothing unplaced.</div>
          )}
        </div>
      )}
    </div>
  );
}

export function WeekPage() {
  const isMobile = useIsMobile();
  const today = todayStr();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [moving, setMoving] = useState<Item | null>(null);
  const [moveDate, setMoveDate] = useState<DateStr>(today);
  const [active, setActive] = useState<Item | null>(null);
  const [activeTimed, setActiveTimed] = useState<SurfaceTimedItem | null>(null);

  const weekEnd = addDays(weekStart, 6);
  const days: DateStr[] = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  // Look back so "stay"-policy items missed in earlier weeks surface as Overdue.
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const tags = composeTagFilter(tagFilter);
  // Day-granular: the item on its own day only — its Time blocks are Schedule detail (ADR 0028).
  const items = useSurfaceItems({ start: addDays(weekStart, -90), end: weekEnd }, { tags }).filter((i) => !i.start);
  const pool = usePoolItems({ tags });
  // Time blockers are bands on the hour-scaled Schedule, not things on a day (ADR 0027).
  const timed = useTimedItems({ start: weekStart, end: weekEnd }, { tags }).filter((t) => !t.background);
  const overdue = items.filter((i) => i.displayDate < weekStart && !i.completedOn);
  const inWeek = items.filter((i) => i.displayDate >= weekStart);

  // A touch that moves scrolls, so a phone drag is a long press (ADR 0021,
  // as on the Schedule): mouse keeps its 4px threshold.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
  );

  function drop(item: Item, to: DateStr | null) {
    const from = item.displayDate ?? null;
    if (from === to) return;
    moveSurfaceItem(item, to)
      .then(() => toast.success(to ? `Moved to ${formatHuman(to)}` : "Back to the pool"))
      .catch((err: Error) => toast.error(err.message));
  }

  function onDragEnd(e: DragEndEvent) {
    setActive(null);
    if (!e.over) return;
    const overId = String(e.over.id);
    const timedItem = e.active.data.current?.timed as SurfaceTimedItem | undefined;
    if (timedItem) {
      if (overId === POOL || overId === timedItem.date) return;
      moveTimedItem(timedItem, overId)
        .then(() => toast.success(`Moved to ${formatHuman(overId)}`))
        .catch((err: Error) => toast.error(err.message));
      return;
    }
    const item = e.active.data.current?.item as Item | undefined;
    if (!item) return;
    drop(item, overId === POOL ? null : overId);
  }

  const openCount = inWeek.filter((i) => !i.completedOn).length;
  const activeTitle = active?.title ?? activeTimed?.title;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => {
        setActive((e.active.data.current?.item as Item) ?? null);
        setActiveTimed((e.active.data.current?.timed as SurfaceTimedItem) ?? null);
      }}
      onDragEnd={(e) => {
        setActiveTimed(null);
        onDragEnd(e);
      }}
      onDragCancel={() => {
        setActive(null);
        setActiveTimed(null);
      }}
    >
      <div className="flex h-full flex-col gap-3 p-4 max-md:gap-2 max-md:p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight">Week</h1>
          <span className="text-muted-foreground text-sm">{weekLabel(weekStart)}</span>
          <Badge variant="secondary" className="ml-1">
            {openCount} open
          </Badge>
          <div className="ml-auto flex items-center gap-1 max-md:ml-0 max-md:w-full">
            <TagFilterBar value={tagFilter} onChange={setTagFilter} className="mr-2 max-md:mr-auto" />
            <Button size="icon" variant="outline" className="size-8" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" className="h-8" onClick={() => setWeekStart(startOfWeek(today))}>
              Today
            </Button>
            <Button size="icon" variant="outline" className="size-8" onClick={() => setWeekStart((w) => addDays(w, 7))}>
              <ChevronRight />
            </Button>
          </div>
        </div>

        {isMobile ? (
          // Seven columns are ~11px wide on a phone: the week becomes a stack
          // of days, scrolled as one, with the pool as a drawer above it.
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
            <PoolDrawer items={pool} overdue={overdue} onMove={setMoving} />
            {days.map((d, i) => (
              <Column
                key={d}
                id={d}
                stacked
                title={DAY_NAMES[i]}
                subtitle={String(parts(d).day)}
                highlight={d === today}
                items={inWeek.filter((it) => it.displayDate === d)}
                timed={timed.filter((t) => t.date === d)}
                onMove={setMoving}
                className={d < today ? "bg-muted/30" : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[14rem_1fr] gap-2">
            <Column id={POOL} title="Unplaced" subtitle="pool" items={pool} onMove={setMoving}>
              {overdue.length > 0 && (
                <div className="mb-1 grid grid-cols-1 gap-1.5">
                  <div className="text-destructive px-0.5 text-xs font-medium">
                    Overdue ({overdue.length})
                  </div>
                  {overdue.map((item) => (
                    <ItemCard key={item.key} item={item} onMove={setMoving} />
                  ))}
                  <div className="bg-border my-1 h-px" />
                </div>
              )}
            </Column>
            <div className="grid min-h-0 min-w-0 grid-cols-7 gap-2">
              {days.map((d, i) => (
                <Column
                  key={d}
                  id={d}
                  title={DAY_NAMES[i]}
                  subtitle={String(parts(d).day)}
                  highlight={d === today}
                  items={inWeek.filter((it) => it.displayDate === d)}
                  timed={timed.filter((t) => t.date === d)}
                  onMove={setMoving}
                  className={d < today ? "bg-muted/30" : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {isMobile && (
          <p className="text-muted-foreground shrink-0 text-[11px]">
            Press and hold the grip to drag · tap a card for its actions.
          </p>
        )}
      </div>

      <DragOverlay dropAnimation={null}>
        {activeTitle && (
          <div className="bg-card rounded-md border px-2 py-1.5 text-sm shadow-md">{activeTitle}</div>
        )}
      </DragOverlay>

      <Dialog open={moving !== null} onOpenChange={(o) => !o && setMoving(null)}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Move "{moving?.title}"</DialogTitle>
          </DialogHeader>
          <Input type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoving(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (moving && moveDate) drop(moving, moveDate);
                setMoving(null);
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
