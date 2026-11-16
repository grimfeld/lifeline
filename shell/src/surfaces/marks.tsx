import { isMissedMarker, todayStr, type SchedulableItem, type TimedItem } from "@lifeline/core";
import { cn } from "@lifeline/ui";

/** The small mark a work item wears before its title — a Task's Project's face (ADR 0060). */
export function ItemMark({ mark }: { mark?: SchedulableItem["mark"] }) {
  if (!mark) return null;
  return (
    // ui-allow: text-size — scales with the title it marks (em), not a fixed step
    <span className="mr-1 inline-block shrink-0 text-[0.85em] font-semibold leading-none" style={{ color: mark.color }} aria-hidden>
      {mark.text}
    </span>
  );
}

/** A Deadline marker whose day has passed (ADR 0061): drawn red where it stands. */
export function missed(item: Pick<TimedItem, "marker" | "occasion" | "date">): boolean {
  return isMissedMarker(item, todayStr());
}

/** Where a Timed Event happens (ADR 0119), beside its title: "At Chez Janou", or nothing. */
export function AtMark({ item, className }: { item: Pick<TimedItem, "at">; className?: string }) {
  if (!item.at) return null;
  return <span className={cn("text-muted-foreground min-w-0 truncate font-normal", className)}>At {item.at.title}</span>;
}
