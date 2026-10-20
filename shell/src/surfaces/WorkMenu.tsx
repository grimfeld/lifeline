import { useState } from "react";
import {
  Button,
  Dialog,
  DatePicker,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@lifeline/ui";
import {
  appById,
  canUnplace,
  completeSurfaceItem,
  formatHuman,
  moveSurfaceItem,
  unplaceItem,
  type DateStr,
  type PoolItem,
  type SurfaceItem,
} from "@lifeline/core";
import { CalendarClock, Check, Inbox, MapPin, PinOff } from "lucide-react";
import { usePush } from "./push";

/** A work item on a day-granular view: placed on a day, or in the pool. */
export type DayWork = (SurfaceItem | (PoolItem & { displayDate?: undefined; placementId?: undefined; start?: undefined; end?: undefined })) & { color?: string };

const fail = (err: Error) => toast.error(err.message);

export function completeWork(item: DayWork) {
  completeSurfaceItem(item as SurfaceItem)
    .then(() => toast.success(`${item.title} done`))
    .catch(fail);
}

/** Move to a day, or back to the pool with `null`. The owning App decides what that means (CONTEXT.md — Move). */
export function moveWork(item: DayWork, to: DateStr | null) {
  if ((item.displayDate ?? null) === to) return;
  moveSurfaceItem(item, to)
    .then(() => toast.success(to ? `Moved to ${formatHuman(to)}` : "Back to the pool"))
    .catch(fail);
}

/**
 * A work item's actions on Month and Upcoming: Complete, Push, Move to day…,
 * Unplace, Unpin. Opened by its row's tap rather than by a trigger of its
 * own — the row is also what a long press drags, and a menu that opened on
 * press would fight the drag. Sits inside a `relative` row, anchored to it.
 */
export function WorkMenu({ item, open, onOpenChange, onMove }: { item: DayWork; open: boolean; onOpenChange: (o: boolean) => void; onMove: (item: DayWork) => void }) {
  const push = usePush(item);
  const done = !!item.completedOn;
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <span aria-hidden className="pointer-events-none absolute inset-0" />
      </DropdownMenuTrigger>
      {/* Portalled, but React events still bubble to the row and its day — keep them here. */}
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        <div className="text-muted-foreground px-2 py-1 text-xs">
          {appById(item.appId)?.title} · {item.subtitle ?? item.title}
          {item.urgency === "overdue" && !done ? " · overdue" : ""}
        </div>
        {!done && (
          <DropdownMenuItem onClick={() => completeWork(item)}>
            <Check /> Complete
          </DropdownMenuItem>
        )}
        {push && (
          <DropdownMenuItem onClick={push}>
            <CalendarClock /> Push
          </DropdownMenuItem>
        )}
        {!done && (
          <DropdownMenuItem onClick={() => onMove(item)}>
            <MapPin /> Move to day…
          </DropdownMenuItem>
        )}
        {!done && canUnplace(item.appId) && item.displayDate !== undefined && (
          <DropdownMenuItem onClick={() => moveWork(item, null)}>
            <Inbox /> Unplace
          </DropdownMenuItem>
        )}
        {item.placementId && !item.start && (
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

/** "Move to day…": the precise route beside the drag. */
export function useMoveDialog(today: DateStr) {
  const [moving, setMoving] = useState<DayWork | null>(null);
  const [date, setDate] = useState<DateStr>(today);
  const start = (item: DayWork) => {
    setMoving(item);
    setDate(item.displayDate ?? today);
  };
  const dialog = (
    <Dialog open={moving !== null} onOpenChange={(o) => !o && setMoving(null)}>
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Move "{moving?.title}"</DialogTitle>
        </DialogHeader>
        <DatePicker required value={date} onChange={setDate} aria-label="Day" />
        <DialogFooter>
          <Button variant="outline" onClick={() => setMoving(null)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (moving && date) moveWork(moving, date);
              setMoving(null);
            }}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
  return { start, dialog };
}
