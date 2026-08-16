import { Button, toast } from "@lifeline/ui";
import { addDays, todayStr, type CardProps } from "@lifeline/core";
import { Check, Repeat } from "lucide-react";
import { completedInRange, dayLabel, groupByDay } from "../domain/completed";
import { setCompleted, useOverrides, useTasks } from "../data/repo";

/** Card: what got done in the last N days, grouped by day; untick to undo. */
export function CompletedCard({ settings }: CardProps) {
  const days = Math.max(1, Number(settings.days) || 7);
  const tasks = useTasks();
  const overrides = useOverrides();
  const today = todayStr();
  const groups = groupByDay(completedInRange(tasks, overrides, addDays(today, 1 - days), today));

  if (groups.length === 0) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        {days === 1 ? "Nothing done today yet." : `Nothing done in the last ${days} days.`}
      </div>
    );
  }

  return (
    <div className="grid h-full content-start gap-2 overflow-y-auto">
      {groups.map((g) => (
        <section key={g.day}>
          <div className="text-muted-foreground flex items-baseline justify-between px-1 text-xs">
            <span className="font-medium">{dayLabel(g.day, today)}</span>
            <span>{g.entries.length}</span>
          </div>
          <ul className="grid content-start gap-1">
            {g.entries.map((e) => (
              <li key={e.key} className="flex items-center gap-2 rounded-md px-1 py-0.5">
                <Button
                  size="icon"
                  variant="default"
                  className="size-6 shrink-0 rounded-full"
                  title="Mark not done"
                  onClick={() => {
                    void setCompleted(e.key, null);
                    toast.success(`${e.title} reopened`);
                  }}
                >
                  <Check className="size-3" />
                </Button>
                <span className="truncate text-sm">{e.title}</span>
                {e.recurring && (
                  <Repeat className="text-muted-foreground size-3 shrink-0" aria-label="recurring" />
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
