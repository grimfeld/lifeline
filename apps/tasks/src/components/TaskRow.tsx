import {
  Badge,
  Button,
  cn,
  DatePickerPanel,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  formatMinutes,
  TagChips,
  toast,
  usePushFlow,
} from "@lifeline/ui";
import { formatHuman, pushSurfaceItem, todayStr, type DateStr } from "@lifeline/core";
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  Check,
  Clock,
  Inbox,
  MapPin,
  MoreHorizontal,
  Pencil,
  Repeat,
  Trash2,
} from "lucide-react";
import type { TaskItem } from "../domain/occurrences";
import { describeRecurrence } from "../domain/occurrences";
import { deleteTask, moveItem, setArchived, setCompleted } from "../data/repo";
import { APP_ID } from "../schedulable";
import type { Task } from "../domain/types";

/**
 * Small "move to day" prompt shared by rows and cards: the calendar in place
 * (ADR 0087), so tapping a day moves the item and closes it. Cancel backs out.
 */
export function MoveDialog({
  item,
  onClose,
}: {
  item: { itemId: string; title: string; date: DateStr | null } | null;
  onClose: () => void;
}) {
  const pick = (to: string) => {
    if (item && to && to !== item.date) {
      void moveItem(item.itemId, to);
      toast.success(`Moved to ${formatHuman(to)}`);
    }
    onClose();
  };
  return (
    <Dialog open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="sm:max-w-xs"
        // Focus the selected day (or today), so the arrows move between days at once;
        // the Calendar's own autoFocus is pulled back by the Dialog's focus trap.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          (e.currentTarget as HTMLElement).querySelector<HTMLElement>('[role="gridcell"] button[tabindex="0"]')?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>Move "{item?.title}"</DialogTitle>
        </DialogHeader>
        <div className="flex justify-center">
          <DatePickerPanel value={item?.date ?? todayStr()} onPick={pick} required />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function TaskRow({
  item,
  onEdit,
  onMove,
  showDate = true,
  completable = true,
}: {
  item: TaskItem;
  onEdit: (t: Task) => void;
  onMove: (item: TaskItem) => void;
  showDate?: boolean;
  /** false for a recurring Task's definition row (only Occurrences complete/move). */
  completable?: boolean;
}) {
  const { task } = item;
  const today = todayStr();
  const done = !!item.completedOn;
  const overdue = !done && !item.lapsed && item.date !== null && item.date < today;
  const archived = task.status === "archived";
  const pushFlow = usePushFlow();
  // Push (ADR 0054) acts on what can be done: an open one-time Task or an Occurrence, never a recurring definition row.
  const pushable = !archived && completable && !done;
  const push = () =>
    pushFlow.push({
      title: task.title,
      estimateMin: task.estimate,
      run: (min) => pushSurfaceItem({ appId: APP_ID, itemId: item.itemId, date: item.date, estimateMin: task.estimate }, min),
    });

  return (
    <>
      <div
        className={cn(
          "bg-card flex items-center gap-3 rounded-lg border px-3 py-2",
          done && "opacity-60",
        )}
      >
        {!archived && completable && (
          <Button
            size="icon"
            variant={done ? "default" : "outline"}
            className="size-7 shrink-0 rounded-full"
            title={done ? "Mark not done" : "Mark done"}
            onClick={() => {
              void setCompleted(item.itemId, done ? null : today);
              if (!done) toast.success(`${task.title} done`);
            }}
          >
            <Check className="size-3.5" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <div className={cn("truncate text-sm font-medium", done && "line-through")}>
            {task.title}
          </div>
          <div className="text-muted-foreground flex items-center gap-1.5 overflow-hidden text-xs">
            {task.recurrence && (
              <span className="flex shrink-0 items-center gap-1.5">
                <Repeat className="size-3" /> {describeRecurrence(task.recurrence)}
              </span>
            )}
            {task.estimate && (
              <span className="flex shrink-0 items-center gap-1" title="Estimate">
                <Clock className="size-3" /> {formatMinutes(task.estimate)}
              </span>
            )}
            {item.moved && item.sourceDate && (
              <span className="shrink-0">· moved from {formatHuman(item.sourceDate)}</span>
            )}
            {task.notes && <span className="min-w-0 truncate">{task.recurrence ? "· " : ""}{task.notes}</span>}
            {(task.tags ?? []).length > 0 && (
              <TagChips tags={task.tags} size="xs" className="max-w-1/2 min-w-0 flex-nowrap overflow-hidden [&>*]:truncate" />
            )}
          </div>
        </div>
        {showDate && item.date && (
          <Badge variant={overdue ? "destructive" : item.date === today ? "default" : "secondary"}>
            {item.date === today ? "Today" : formatHuman(item.date)}
          </Badge>
        )}
        {showDate && item.date === null && !task.recurrence && (
          <Badge variant="outline">Unassigned</Badge>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" className="shrink-0" aria-label="More">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Pencil /> Edit
            </DropdownMenuItem>
            {pushable && (
              <DropdownMenuItem onClick={push}>
                <CalendarClock /> Push
              </DropdownMenuItem>
            )}
            {!archived && completable && (
              <DropdownMenuItem onClick={() => onMove(item)}>
                <MapPin /> Move to day…
              </DropdownMenuItem>
            )}
            {!archived && !task.recurrence && item.date !== null && (
              <DropdownMenuItem onClick={() => void moveItem(item.itemId, null)}>
                <Inbox /> Unassign
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {archived ? (
              <DropdownMenuItem onClick={() => void setArchived(task, false)}>
                <ArchiveRestore /> Restore
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => void setArchived(task, true)}>
                <Archive /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deleteTask(task.id);
                toast.success("Task deleted");
              }}
            >
              <Trash2 /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {pushFlow.dialog}
    </>
  );
}
