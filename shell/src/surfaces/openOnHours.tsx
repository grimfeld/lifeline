import { useCallback, useState, type ReactNode } from "react";
import { openPeek, schedulablePeekId, timedPeekId, type DateStr, type HoursTapped } from "@lifeline/core";
import { HoursEditor, type HoursEditing } from "./HoursEditor";

/**
 * The Document whose Peek a tap on the hours opens: an Event's, whole, from
 * any of its pieces (#536); a Task's, from its Time block or untimed chip
 * (#537). Null leaves the item to the hours editor — for now a Time blocker
 * band, another App's Timed item and other Apps' work (#538).
 */
export function peekIdOnHours(tapped: HoursTapped): string | null {
  return tapped.kind === "timed" ? timedPeekId(tapped.item) : schedulablePeekId(tapped.item);
}

/**
 * Opening what was tapped on a time Surface (the Schedule, Month, Upcoming,
 * the Agenda Card): its Peek, told what was tapped and where, so it can draw
 * that timing and hand the focus back on close (#284) — or, for an item with
 * no Peek yet, the hours editor, which the caller mounts (`editor`).
 */
export function useOpenOnHours({
  defaultDay,
  inView,
  onGo,
}: {
  /** The day an untimed pool chip's new block lands on. */
  defaultDay: DateStr;
  /** Whether a day is on screen: moving the item off it closes the hours editor. */
  inView: (d: DateStr) => boolean;
  /** Show another day (the hours editor's moved-to toast's Go). */
  onGo: (d: DateStr) => void;
}): { open: (tapped: HoursTapped, anchor: HTMLElement) => void; editor: ReactNode } {
  const [editing, setEditing] = useState<(HoursEditing & { id: number }) | null>(null);
  const open = useCallback((tapped: HoursTapped, anchor: HTMLElement) => {
    const docId = peekIdOnHours(tapped);
    // An unplaced pool chip has no day of its own: the Peek gives it a time on the day shown.
    const told: HoursTapped = tapped.kind === "work" && !tapped.item.displayDate && !tapped.item.date ? { kind: "work", item: { ...tapped.item, displayDate: defaultDay } } : tapped;
    if (docId) openPeek(docId, { tapped: told, anchor });
    else setEditing({ target: tapped, anchor, id: Date.now() });
  }, [defaultDay]);
  const editor = editing && (
    <HoursEditor key={editing.id} editing={editing} defaultDay={defaultDay} inView={inView} onGo={onGo} onClose={() => setEditing(null)} />
  );
  return { open, editor };
}
