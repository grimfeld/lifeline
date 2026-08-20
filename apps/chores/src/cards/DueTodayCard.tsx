import { Button, toast } from "@lifeline/ui";
import { matchesTagFilter, todayStr, useTagFilter } from "@lifeline/core";
import { Check } from "lucide-react";
import { completeChore, lastDoneMap, useChores, useCompletions } from "../data/repo";
import { dueState } from "../domain/schedule";

/** Card: chores needing doing today (overdue included), tick-off inline. */
export function DueTodayCard() {
  const chores = useChores();
  const completions = useCompletions();
  const today = todayStr();
  const last = lastDoneMap(completions);
  const filter = useTagFilter();

  const due = chores
    .filter((c) => c.status === "active" && matchesTagFilter(c.tags, filter))
    .map((c) => ({ chore: c, due: dueState(c, last.get(c.id) ?? null, today) }))
    .filter((r) => r.due.state === "overdue" || r.due.state === "due-today");

  if (due.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        All chores done ✨
      </div>
    );
  }

  return (
    <ul className="grid content-start gap-1 overflow-y-auto">
      {due.map(({ chore, due }) => (
        <li key={chore.id} className="flex items-center gap-2 rounded-md px-1 py-0.5">
          <Button
            size="icon"
            variant="outline"
            className="size-6 shrink-0 rounded-full"
            onClick={() => {
              void completeChore(chore.id, today);
              toast.success(`${chore.title} done`);
            }}
          >
            <Check className="size-3" />
          </Button>
          <span className="truncate text-sm">{chore.title}</span>
          {due.state === "overdue" && (
            <span className="text-destructive ml-auto shrink-0 text-xs">
              {due.daysLate}d late
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
