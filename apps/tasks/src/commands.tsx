import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  toast,
} from "@lifeline/ui";
import { todayStr, type CommandDef } from "@lifeline/core";
import { Check, ListChecks, ListTodo, Plus } from "lucide-react";
import { TaskDialog } from "./components/TaskDialog";
import { dueItems } from "./domain/occurrences";
import { addTask, setCompleted, useOverrides, useTasks } from "./data/repo";
import { readRecurrence, RECURRENCE_HINT } from "./domain/recurrence";
import { PROJECT } from "./domain/types";

function AddTaskCommandDialog(props: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <TaskDialog {...props} />;
}

function CompleteTaskCommandDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const tasks = useTasks();
  const overrides = useOverrides();
  const [done, setDone] = useState<string[]>([]);
  const today = todayStr();
  const due = dueItems(tasks, overrides, today).filter((i) => !i.completedOn);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Complete a task</DialogTitle>
        </DialogHeader>
        {due.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing due today.</p>
        ) : (
          <ul className="grid gap-1">
            {due.map((item) => (
              <li key={item.itemId}>
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  disabled={done.includes(item.itemId)}
                  onClick={() => {
                    void setCompleted(item.itemId, today);
                    setDone((d) => [...d, item.itemId]);
                    toast.success(`${item.task.title} done`);
                  }}
                >
                  <Check className={done.includes(item.itemId) ? "" : "opacity-30"} />
                  <span className="truncate">{item.task.title}</span>
                  {item.date! < today && (
                    <span className="text-destructive ml-auto text-xs">overdue</span>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const taskCommands: CommandDef[] = [
  {
    id: "tasks.add",
    title: "Add task",
    keywords: ["new", "create", "todo", "task"],
    icon: Plus,
    dialog: AddTaskCommandDialog,
    capture: true,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "date", label: "Day", kind: "date", hint: "The day it is assigned to. Omit to leave it in the Unassigned pool; ignored for a recurring task." },
      { key: "recurrence", label: "Repeats", kind: "json", hint: RECURRENCE_HINT },
      { key: "notes", label: "Notes", kind: "longtext" },
      { key: "estimate", label: "Estimate", kind: "number", hint: "Whole minutes the task should take." },
      { key: "tags", label: "Tags", kind: "list" },
      { key: "project", label: "Project", kind: "link", linkType: PROJECT, hint: "The Project it serves." },
    ],
    async invoke(a) {
      const recurrence = a.recurrence === undefined ? null : readRecurrence(a.recurrence);
      const estimate = a.estimate === undefined ? null : Math.round(a.estimate as number);
      if (estimate !== null && estimate <= 0) throw new Error("Estimate must be a positive number of minutes");
      const id = await addTask({
        title: a.title as string,
        date: (a.date as string | undefined) ?? null,
        recurrence,
        notes: a.notes as string | undefined,
        estimate,
        tags: a.tags as string[] | undefined,
        project: (a.project as string | undefined) ?? null,
      });
      const when = recurrence ? "recurring" : a.date ? `on ${a.date}` : "unassigned";
      return { id, message: `Added task “${a.title}” (${when})` };
    },
  },
  {
    id: "tasks.complete",
    title: "Complete a task",
    keywords: ["done", "tick", "finish", "task"],
    icon: ListChecks,
    dialog: CompleteTaskCommandDialog,
  },
  {
    id: "tasks.week",
    title: "Plan the week",
    keywords: ["week", "planner", "tasks"],
    icon: ListTodo,
    // The Week planner retired into the Calendar's Week (ADR 0063).
    run: ({ navigate }) => navigate("/calendar?view=week"),
  },
];
