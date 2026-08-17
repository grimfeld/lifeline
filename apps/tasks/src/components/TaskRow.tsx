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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  TagChips,
  toast,
} from "@lifeline/ui";
import { formatHuman, todayStr, type DateStr } from "@lifeline/core";
import {
  Archive,
  ArchiveRestore,
  Check,
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
import type { Task } from "../domain/types";

/** Small "move to day" prompt shared by rows and cards. */
export function MoveDialog({
  item,
  onClose,
}: {
  item: { itemId: string; title: string; date: DateStr | null } | null;
  onClose: () => void;
}) {
  const [date, setDate] = useState<string>("");
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(o) => {
        if (!o) onClose();
        else setDate(item?.date ?? todayStr());
      }}
    >
      <DialogContent className="sm:max-w-xs">
        <DialogHeader>
          <DialogTitle>Move "{item?.title}"</DialogTitle>
        </DialogHeader>
        <Input
          type="date"
          value={date || item?.date || todayStr()}
          onChange={(e) => setDate(e.target.value)}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const to = date || item?.date || todayStr();
              if (item) {
                void moveItem(item.itemId, to);
                toast.success(`Moved to ${formatHuman(to)}`);
              }
              onClose();
            }}
          >
            Move
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
  const overdue = !done && item.date !== null && item.date < today;
  const archived = task.status === "archived";

  return (
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
        <div className="text-muted-foreground flex items-center gap-1.5 truncate text-xs">
          {task.recurrence && (
            <>
              <Repeat className="size-3" /> {describeRecurrence(task.recurrence)}
            </>
          )}
          {item.moved && item.sourceDate && (
            <span>· moved from {formatHuman(item.sourceDate)}</span>
          )}
          {task.notes && <span className="truncate">{task.recurrence ? "· " : ""}{task.notes}</span>}
          {(task.tags ?? []).length > 0 && <TagChips tags={task.tags} size="xs" className="shrink-0" />}
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
          <Button size="icon" variant="ghost" className="size-7">
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(task)}>
            <Pencil /> Edit
          </DropdownMenuItem>
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
  );
}
