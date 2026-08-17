import { Button, cn, toast } from "@lifeline/ui";
import { addDays, matchesTagFilter, todayStr, useTagFilter } from "@lifeline/core";
import { Check, Repeat } from "lucide-react";
import { deriveItems } from "../domain/occurrences";
import { setCompleted, useOverrides, useTasks } from "../data/repo";

/** Card: today's tasks (overdue one-time tasks included), tick-off inline. */
export function TodayTasksCard() {
  const tasks = useTasks();
  const overrides = useOverrides();
  const filter = useTagFilter();
  const today = todayStr();
  const items = deriveItems(tasks, overrides, { start: addDays(today, -60), end: today }).filter(
    (i) =>
      i.date !== null &&
      (i.date === today || (i.date < today && !i.completedOn)) &&
      matchesTagFilter(i.task.tags, filter),
  );
  const open = items.filter((i) => !i.completedOn);
  const done = items.filter((i) => i.completedOn);

  if (items.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        No tasks today.
      </div>
    );
  }

  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {[...open, ...done].map((item) => (
        <li key={item.itemId} className="flex items-center gap-2 rounded-md px-1 py-0.5">
          <Button
            size="icon"
            variant={item.completedOn ? "default" : "outline"}
            className="size-6 shrink-0 rounded-full"
            onClick={() => {
              void setCompleted(item.itemId, item.completedOn ? null : today);
              if (!item.completedOn) toast.success(`${item.task.title} done`);
            }}
          >
            <Check className="size-3" />
          </Button>
          <span
            className={cn("truncate text-sm", item.completedOn && "text-muted-foreground line-through")}
          >
            {item.task.title}
          </span>
          {item.recurring && <Repeat className="text-muted-foreground size-3 shrink-0" />}
          {!item.completedOn && item.date! < today && (
            <span className="text-destructive ml-auto shrink-0 text-xs">overdue</span>
          )}
        </li>
      ))}
    </ul>
  );
}
