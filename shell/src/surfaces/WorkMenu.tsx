import { useRef, useState, type ReactNode } from "react";
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
  type SchedulableItem,
  type SurfaceItem,
} from "@lifeline/core";
import { CalendarClock, Check, Inbox, MapPin, PinOff } from "lucide-react";
import { usePush } from "./push";

/** A work item on a day-granular view: placed on a day, or in the pool. */
export type DayWork = (SurfaceItem | (PoolItem & { displayDate?: undefined; placementId?: undefined; start?: undefined; end?: undefined })) & { color?: string };

/** What the work actions need of an item: a day-granular row's, or what was tapped on the hours. */
type Actionable = Pick<SchedulableItem, "appId" | "itemId" | "title" | "date" | "estimateMin" | "completedOn"> & { displayDate?: DateStr; placementId?: string; start?: string | null };

const fail = (err: Error) => toast.error(`Could not save: ${err.message}`);

export function completeWork(item: Actionable) {
  completeSurfaceItem(item)
    .then(() => toast.success(`${item.title} done`))
    .catch(fail);
}

/** Move to a day, or back to the pool with `null`. The owning App decides what that means (CONTEXT.md — Move). */
export function moveWork(item: Actionable, to: DateStr | null) {
  if ((item.displayDate ?? null) === to) return;
  moveSurfaceItem(item, to)
    .then(() => toast.success(to ? `Moved to ${formatHuman(to)}` : "Back to the pool"))
    .catch(fail);
}

/** One of a work item's actions, as its menu on Month and Upcoming and its Peek both offer them. */
export interface WorkAction {
  id: "complete" | "push" | "move" | "unplace" | "unpin";
  label: string;
  icon: ReactNode;
  run: () => void;
}

/** A work item's actions, as its App allows: Complete, Push, Move to day…, Unplace, Unpin. */
export function useWorkActions(item: Actionable, onMove: (item: Actionable) => void): WorkAction[] {
  const push = usePush(item);
  const done = !!item.completedOn;
  const placementId = item.placementId;
  const out: WorkAction[] = [];
  if (!done) out.push({ id: "complete", label: "Complete", icon: <Check />, run: () => completeWork(item) });
  if (push) out.push({ id: "push", label: "Push", icon: <CalendarClock />, run: push });
  if (!done) out.push({ id: "move", label: "Move to day…", icon: <MapPin />, run: () => onMove(item) });
  if (!done && canUnplace(item.appId) && item.displayDate !== undefined) out.push({ id: "unplace", label: "Unplace", icon: <Inbox />, run: () => moveWork(item, null) });
  if (placementId && !item.start)
    out.push({
      id: "unpin",
      label: "Unpin",
      icon: <PinOff />,
      run: () => {
        void unplaceItem(placementId);
        toast.success("Pin removed — back to its natural day");
      },
    });
  return out;
}

/**
 * A work item's actions on Month and Upcoming (`useWorkActions`), on a
 * right-click or the menu key. Opened by its row rather than by a trigger of
 * its own — the row is also what a long press drags, and a menu that opened
 * on press would fight the drag; a touch reaches the same actions in the
 * item's Peek. Sits inside a `relative` row, anchored to it.
 */
export function WorkMenu({ item, open, onOpenChange, onMove }: { item: DayWork; open: boolean; onOpenChange: (o: boolean) => void; onMove: (item: Actionable) => void }) {
  const actions = useWorkActions(item, onMove);
  const done = !!item.completedOn;
  const anchor = useRef<HTMLSpanElement>(null);
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <span ref={anchor} aria-hidden className="pointer-events-none absolute inset-0" />
      </DropdownMenuTrigger>
      {/* Portalled, but React events still bubble to the row and its day — keep them here. */}
      <DropdownMenuContent
        align="start"
        onClick={(e) => e.stopPropagation()}
        onCloseAutoFocus={(e) => {
          // The trigger is a bare span: the focus goes back to the row that opened the menu, when it takes one.
          const row = anchor.current?.parentElement;
          if (row && row.tabIndex >= 0) {
            e.preventDefault();
            row.focus({ preventScroll: true });
          }
        }}
      >
        <div className="text-muted-foreground px-2 py-1 text-xs">
          {appById(item.appId)?.title} · {item.subtitle ?? item.title}
          {item.urgency === "overdue" && !done ? " · overdue" : ""}
        </div>
        {actions.map((a) => (
          <DropdownMenuItem key={a.id} onClick={a.run}>
            {a.icon} {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Move to day…": the precise route beside the drag. */
export function useMoveDialog(today: DateStr, onMoved?: () => void) {
  const [moving, setMoving] = useState<Actionable | null>(null);
  const [date, setDate] = useState<DateStr>(today);
  const start = (item: Actionable) => {
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
              onMoved?.();
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
