import { useState } from "react";
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
  completeSurfaceItem,
  fromParts,
  daysInMonth,
  parts,
  moveSurfaceItem,
  startOfWeek,
  todayStr,
  unplaceItem,
  useSurfaceItems,
  useTimedItems,
  formatTime,
  type DateStr,
  type SurfaceItem,
  type SurfaceTimedItem,
} from "@lifeline/core";
import { Check, ChevronLeft, ChevronRight, MapPin, Pin, PinOff } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function TimedChip({ item }: { item: SurfaceTimedItem }) {
  return (
    <div
      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-xs"
      title={`${appById(item.appId)?.title} · ${item.subtitle ?? item.title}`}
    >
      <span
        className="size-1.5 shrink-0 rounded-sm"
        style={{ background: item.color ?? "var(--muted-foreground)" }}
      />
      {item.start && <span className="text-muted-foreground shrink-0">{formatTime(item.start)}</span>}
      <span className="truncate">{item.title}</span>
    </div>
  );
}

function ItemChip({ item, onMove }: { item: SurfaceItem; onMove: (i: SurfaceItem) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-xs transition-colors hover:bg-accent",
            item.completedOn && "text-muted-foreground line-through",
            item.urgency === "overdue" && !item.completedOn && "text-destructive",
          )}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ background: item.color ?? "var(--muted-foreground)" }}
          />
          <span className="truncate">{item.title}</span>
          {item.placementId && <Pin className="text-muted-foreground ml-auto size-3 shrink-0" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <div className="text-muted-foreground px-2 py-1 text-xs">
          {appById(item.appId)?.title} · {item.subtitle ?? item.title}
        </div>
        {!item.completedOn && (
          <DropdownMenuItem
            onClick={() => {
              void completeSurfaceItem(item);
              toast.success(`${item.title} done`);
            }}
          >
            <Check /> Complete
          </DropdownMenuItem>
        )}
        {!item.completedOn && (
          <DropdownMenuItem onClick={() => onMove(item)}>
            <MapPin /> Move to day…
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
  );
}

export function CalendarPage() {
  const today = todayStr();
  const [anchor, setAnchor] = useState(() => {
    const { y, m } = parts(today);
    return { y, m };
  });
  const [moving, setMoving] = useState<SurfaceItem | null>(null);
  const [moveDate, setMoveDate] = useState<DateStr>(today);

  const monthStart = fromParts(anchor.y, anchor.m, 1);
  const monthEnd = fromParts(anchor.y, anchor.m, daysInMonth(anchor.y, anchor.m));
  const gridStart = startOfWeek(monthStart);
  const days: DateStr[] = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const items = useSurfaceItems({ start: gridStart, end: addDays(gridStart, 41) });
  const timed = useTimedItems({ start: gridStart, end: addDays(gridStart, 41) });

  function shift(dm: number) {
    setAnchor(({ y, m }) => {
      const nm = m + dm;
      if (nm < 1) return { y: y - 1, m: 12 };
      if (nm > 12) return { y: y + 1, m: 1 };
      return { y, m: nm };
    });
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {MONTHS[anchor.m - 1]} {anchor.y}
        </h1>
        <Badge variant="secondary" className="ml-1">
          {items.filter((i) => !i.completedOn && i.displayDate === today).length} today
        </Badge>
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="outline" className="size-8" onClick={() => shift(-1)}>
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            className="h-8"
            onClick={() => {
              const { y, m } = parts(today);
              setAnchor({ y, m });
            }}
          >
            Today
          </Button>
          <Button size="icon" variant="outline" className="size-8" onClick={() => shift(1)}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="text-muted-foreground grid grid-cols-7 gap-px text-center text-xs font-medium">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="bg-border grid flex-1 grid-cols-7 grid-rows-6 gap-px overflow-hidden rounded-lg border">
        {days.map((d) => {
          const inMonth = d >= monthStart && d <= monthEnd;
          const dayItems = items.filter((i) => i.displayDate === d);
          return (
            <div
              key={d}
              className={cn(
                "bg-background flex min-h-0 flex-col gap-0.5 p-1",
                !inMonth && "bg-muted/40 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "mb-0.5 self-start rounded-full px-1.5 text-xs leading-5",
                  d === today && "bg-primary text-primary-foreground font-semibold",
                )}
              >
                {parts(d).day}
              </span>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {timed
                  .filter((t) => t.date === d)
                  .map((t) => (
                    <TimedChip key={t.key} item={t} />
                  ))}
                {dayItems.map((item) => (
                  <ItemChip
                    key={item.key}
                    item={item}
                    onMove={(i) => {
                      setMoving(i);
                      setMoveDate(d);
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

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
                if (moving && moveDate) {
                  moveSurfaceItem(moving, moveDate)
                    .then(() => toast.success(`Moved to ${moveDate}`))
                    .catch((err: Error) => toast.error(err.message));
                }
                setMoving(null);
              }}
            >
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
