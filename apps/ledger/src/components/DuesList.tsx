import { Button } from "@lifeline/ui";
import type { Due } from "../domain/types";
import { formatCents } from "../domain/money";
import { describeDueDay, isOverdue } from "../domain/recur";
import { dismissDue } from "../data/repo";

/** Open Dues, overdue loud — a reading only: the bank's import is what clears a Due; skip waves one day off by hand (ADR 0042). */
export function DuesList({ dues, today, compact }: { dues: Due[]; today: string; compact?: boolean }) {
  if (dues.length === 0) return compact ? <p className="text-muted-foreground p-3 text-sm">Nothing due.</p> : null;
  return (
    <ul className={compact ? "grid content-start gap-1 overflow-y-auto p-2" : "grid gap-1"}>
      {dues.map((due) => (
        <li key={`${due.series.key}/${due.date}`} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
          <span className="min-w-0 flex-1 truncate">
            {due.series.payee}
            <span className={`ml-2 text-xs ${isOverdue(due, today) ? "text-destructive" : "text-muted-foreground"}`}>{describeDueDay(due.date, today)}</span>
          </span>
          <span className="text-muted-foreground shrink-0 tabular-nums">{formatCents(due.series.amount)}</span>
          <Button size="sm" variant="ghost" title="Wave this one day off — the bank's import is what clears a Due" onClick={() => void dismissDue(due)}>
            Skip
          </Button>
        </li>
      ))}
    </ul>
  );
}
