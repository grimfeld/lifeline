import { useReducer } from "react";
import { toastWithUndo } from "@lifeline/ui";

/**
 * What the timing sections share. A visit (`peekVisit`) holds the timing, not
 * React: a section draws it again after each of its own writes.
 */
export function useRedraw(): () => void {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  return redraw;
}

/** Offer the Undo a removal gives, once it has one; nothing when the removal failed (the write queue says so). */
export function offerUndo(message: string, removed: Promise<(() => Promise<unknown>) | null>): void {
  void removed.then((undo) => {
    if (undo) toastWithUndo(message, undo);
  });
}
