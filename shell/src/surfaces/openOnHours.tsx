import { useCallback, useState, type ReactNode } from "react";
import { openPeek, timedPeekId, type DateStr, type HoursTapped } from "@lifeline/core";
import { HoursEditor, type HoursEditing } from "./HoursEditor";

/**
 * The Document whose Peek a tap on the hours opens (#536): an Event's, whole,
 * from any of its pieces. Null leaves the item to the hours editor — for now
 * a Task's block or chip (#537), a Time blocker band and another App's Timed
 * item (#538).
 */
export function peekIdOnHours(tapped: HoursTapped): string | null {
  return tapped.kind === "timed" ? timedPeekId(tapped.item) : null;
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
    if (docId) openPeek(docId, { tapped, anchor });
    else setEditing({ target: tapped, anchor, id: Date.now() });
  }, []);
  const editor = editing && (
    <HoursEditor key={editing.id} editing={editing} defaultDay={defaultDay} inView={inView} onGo={onGo} onClose={() => setEditing(null)} />
  );
  return { open, editor };
}
