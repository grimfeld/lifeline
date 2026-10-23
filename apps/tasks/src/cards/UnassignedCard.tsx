import { useState } from "react";
import { Button, Input, toast } from "@lifeline/ui";
import { matchesTagFilter, todayStr, useTagFilter } from "@lifeline/core";
import { CalendarPlus, Check } from "lucide-react";
import { addTask, moveItem, setCompleted, useTasks } from "../data/repo";

/** Card: the Unassigned pool with quick add; "→ today" schedules a task for today. */
export function UnassignedCard() {
  const tasks = useTasks();
  const filter = useTagFilter();
  const [quick, setQuick] = useState("");
  const pool = tasks
    .filter((t) => t.status === "active" && !t.recurrence && t.date === null && !t.completedOn)
    .filter((t) => matchesTagFilter(t.tags, filter))
    .sort((a, b) => a.title.localeCompare(b.title));

  async function quickAdd() {
    const title = quick.trim();
    if (!title) return;
    await addTask({ title, date: null });
    setQuick("");
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <Input
        className="h-8"
        aria-label="Add a task"
        placeholder="Add a task…"
        value={quick}
        onChange={(e) => setQuick(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void quickAdd()}
      />
      {pool.length === 0 ? (
        <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
          Pool is empty.
        </div>
      ) : (
        <ul className="grid content-start gap-1 overflow-y-auto">
          {pool.map((t) => (
            <li key={t.id} className="flex items-center gap-2 rounded-md px-1 py-0.5">
              <Button
                size="icon"
                variant="outline"
                className="size-6 shrink-0 rounded-full"
                title="Done"
                onClick={() => {
                  void setCompleted(t.id, todayStr());
                  toast.success(`${t.title} done`);
                }}
              >
                <Check className="size-3" />
              </Button>
              <span className="truncate text-sm">{t.title}</span>
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto size-6 shrink-0"
                title="Schedule for today"
                onClick={() => void moveItem(t.id, todayStr())}
              >
                <CalendarPlus className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
