import { useCallback, useState, type ReactNode } from "react";
import { openPeek, schedulablePeekId, timedPeekId, type DateStr, type HoursTapped } from "@lifeline/core";
import { HoursCard } from "./HoursCard";

/**
 * The Document whose Peek a tap on the hours opens: an Event's, whole, from
 * any of its pieces (#536); a Task's or a Chore's, from its Time block or
 * untimed chip (#537); a Time blocker's, another App's item's (#538). Null for
 * an item with no Document — an iCal subscription's — which shows a card.
 */
function peekIdOnHours(tapped: HoursTapped): string | null {
  return tapped.kind === "timed" ? timedPeekId(tapped.item) : schedulablePeekId(tapped.item);
}

/**
 * Opening what was tapped on the hours (the Schedule, Month, Upcoming,
 * the Agenda Card): its Peek, told what was tapped and where, so it can draw
 * that timing, keep the item above it on a phone and hand the focus back on
 * close (#284) — or, for an item with no Document, a small read-only card,
 * which the caller mounts (`card`). `anchor` is what was tapped, which takes
 * the focus back; `placeAt`, where a desk card sits beside, when not there.
 */
export function useOpenOnHours({
  defaultDay,
}: {
  /** The day an untimed pool chip's new block lands on. */
  defaultDay: DateStr;
}): { open: (tapped: HoursTapped, anchor: HTMLElement, placeAt?: HTMLElement) => void; card: ReactNode } {
  const [shown, setShown] = useState<{ tapped: HoursTapped; anchor: HTMLElement; placeAt?: HTMLElement; id: number } | null>(null);
  const open = useCallback(
    (tapped: HoursTapped, anchor: HTMLElement, placeAt?: HTMLElement) => {
      const docId = peekIdOnHours(tapped);
      // An unplaced pool chip has no day of its own: the Peek gives it a time on the day shown.
      const told: HoursTapped = tapped.kind === "work" && !tapped.item.displayDate && !tapped.item.date ? { kind: "work", item: { ...tapped.item, displayDate: defaultDay } } : tapped;
      if (docId) openPeek(docId, { tapped: told, anchor });
      else setShown({ tapped, anchor, placeAt, id: Date.now() });
    },
    [defaultDay],
  );
  const card = shown && <HoursCard key={shown.id} tapped={shown.tapped} anchor={shown.anchor} placeAt={shown.placeAt} onClose={() => setShown(null)} />;
  return { open, card };
}
