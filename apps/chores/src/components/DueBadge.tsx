import { Badge } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import type { DueState } from "../domain/schedule";

/** When a Chore is due, as a badge: late, today, or the day it next is. */
export function DueBadge({ due }: { due: DueState }) {
  switch (due.state) {
    case "overdue":
      return (
        <Badge variant="destructive">
          {due.daysLate === 1 ? "1 day late" : `${due.daysLate} days late`}
        </Badge>
      );
    case "due-today":
      return <Badge>Due today</Badge>;
    case "upcoming":
      return <Badge variant="secondary">{formatHuman(due.dueOn)}</Badge>;
    case "not-scheduled":
      return null;
  }
}
