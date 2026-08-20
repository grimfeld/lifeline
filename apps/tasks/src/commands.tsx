import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  toast,
} from "@lifeline/ui";
import { addDays, todayStr, type CommandDef } from "@lifeline/core";
import { Check, ListChecks, ListTodo, Plus } from "lucide-react";
import { TaskDialog } from "./components/TaskDialog";
import { deriveItems } from "./domain/occurrences";
import { setCompleted, useOverrides, useTasks } from "./data/repo";

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
  const due = deriveItems(tasks, overrides, { start: addDays(today, -60), end: today }).filter(
    (i) => i.date !== null && !i.completedOn,
  );

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
    run: ({ navigate }) => navigate("/week"),
  },
];
