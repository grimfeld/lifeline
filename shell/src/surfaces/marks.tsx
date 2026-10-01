import { isMissedMarker, todayStr, type SchedulableItem, type TimedItem } from "@lifeline/core";

/** The small mark a work item wears before its title — a Task's Project's face (ADR 0060). */
export function ItemMark({ mark }: { mark?: SchedulableItem["mark"] }) {
  if (!mark) return null;
  return (
    <span className="mr-1 inline-block shrink-0 text-[0.85em] font-semibold leading-none" style={{ color: mark.color }} aria-hidden>
      {mark.text}
    </span>
  );
}

/** A Deadline marker whose day has passed (ADR 0061): drawn red where it stands. */
export function missed(item: Pick<TimedItem, "marker" | "date">): boolean {
  return isMissedMarker(item, todayStr());
}
