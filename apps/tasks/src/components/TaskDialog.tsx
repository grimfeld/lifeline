import { useEffect, useState } from "react";
import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  toast,
} from "@lifeline/ui";
import { todayStr, useBacklinks, type DateStr, type Weekday } from "@lifeline/core";
import type { Recurrence, Task } from "../domain/types";
import { addTask, updateTask } from "../data/repo";
import { APP_ID } from "../schedulable";

/** Monday-first display order; values are Core weekdays (0 = Sunday). */
export const WEEKDAYS: { value: Weekday; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

type Kind = "one-time" | "weekly";

/** Notes that link to this Task (edit mode only). Hidden when there are none. */
function MentionedIn({ taskId }: { taskId: string }) {
  const backlinks = useBacklinks({ appId: APP_ID, itemId: taskId });
  if (backlinks.length === 0) return null;
  return (
    <div className="text-muted-foreground grid gap-1 text-xs">
      <span>Mentioned in {backlinks.length} {backlinks.length === 1 ? "note" : "notes"}</span>
      <ul className="grid gap-0.5">
        {backlinks.map((b) => (
          <li key={`${b.appId}/${b.sourceId}`} className="truncate">
            {b.href ? (
              <a href={b.href} className="hover:text-foreground underline-offset-2 hover:underline">
                {b.title}
              </a>
            ) : (
              b.title
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TaskDialog({
  open,
  onOpenChange,
  task,
  defaultDate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode. */
  task?: Task;
  /** Create mode: preselected day (null = Unassigned). */
  defaultDate?: DateStr | null;
}) {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [kind, setKind] = useState<Kind>("one-time");
  const [date, setDate] = useState<string>("");
  const [weekdays, setWeekdays] = useState<Weekday[]>([1]);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setNotes(task?.notes ?? "");
    setKind(task?.recurrence ? "weekly" : "one-time");
    setDate(task ? (task.date ?? "") : (defaultDate === undefined ? todayStr() : (defaultDate ?? "")));
    setWeekdays(task?.recurrence?.weekdays ?? [1]);
  }, [open, task, defaultDate]);

  function buildRecurrence(): Recurrence | null {
    if (kind !== "weekly") return null;
    return { kind: "weekly", weekdays: [...weekdays].sort() };
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    if (kind === "weekly" && weekdays.length === 0) {
      toast.error("Pick at least one weekday");
      return;
    }
    const recurrence = buildRecurrence();
    if (task) {
      await updateTask({
        ...task,
        title: title.trim(),
        notes: notes.trim(),
        recurrence,
        date: recurrence ? null : date || null,
        completedOn: recurrence ? null : task.completedOn,
      });
      toast.success("Task updated");
    } else {
      await addTask({ title: title.trim(), notes: notes.trim(), recurrence, date: date || null });
      toast.success("Task added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Call the dentist"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && void submit()}
            />
          </div>
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="one-time">One-time</SelectItem>
                <SelectItem value="weekly">Weekly recurring</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "one-time" ? (
            <div className="grid gap-2">
              <Label htmlFor="task-date">Day</Label>
              <div className="flex gap-2">
                <Input
                  id="task-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                <Button
                  type="button"
                  variant={date ? "outline" : "secondary"}
                  onClick={() => setDate("")}
                >
                  Unassigned
                </Button>
              </div>
              {!date && (
                <p className="text-muted-foreground text-xs">
                  Stays in the Unassigned pool until you drop it on a day.
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <Label>Repeats on</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((wd) => {
                  const on = weekdays.includes(wd.value);
                  return (
                    <button
                      key={wd.value}
                      type="button"
                      aria-pressed={on}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-sm transition-colors",
                        on
                          ? "bg-primary text-primary-foreground border-primary"
                          : "hover:bg-accent",
                      )}
                      onClick={() =>
                        setWeekdays((cur) =>
                          on ? cur.filter((x) => x !== wd.value) : [...cur, wd.value],
                        )
                      }
                    >
                      {wd.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="task-notes">Notes</Label>
            <Textarea
              id="task-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              rows={3}
            />
          </div>
          {task && <MentionedIn taskId={task.id} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{task ? "Save" : "Add task"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
