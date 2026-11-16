import { useRef, type KeyboardEvent } from "react";
import { SNAP_MIN } from "./hours";

/** How far an arrow key moves an item: by whole days, and on the hours by minutes. */
export interface Step {
  days: number;
  minutes: number;
}

/** What a key does to an item on a time surface: open it, or step it. */
export type ItemKey = { open: true } | (Step & { open?: false });

/** What a screen reader says about an item on the hours (dnd-kit's own words promise a Space pick-up no sensor answers). */
export const HOURS_INSTRUCTIONS = "Press Enter to open it. The arrow keys move it: left and right by a day, up and down by 15 minutes, an hour with Shift.";
/** The same on Month, where an item moves by the day. */
export const MONTH_INSTRUCTIONS = "Press Enter to open it. The arrow keys move it: left and right by a day, up and down by a week.";

/**
 * The key an item on the Schedule or the Month takes (WCAG 2.1.1): Enter or
 * Space opens it, an arrow steps it — up and down by `SNAP_MIN` on the hours
 * (an hour with Shift), by a week on the Month. Null for any other key, and
 * for one pressed on a control inside the item (its Complete tick).
 */
export function itemKey(e: KeyboardEvent<HTMLElement>, vertical: "time" | "week"): ItemKey | null {
  if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return null;
  const up = vertical === "week" ? { days: -7, minutes: 0 } : { days: 0, minutes: -(e.shiftKey ? 60 : SNAP_MIN) };
  const k: ItemKey | null =
    e.key === "Enter" || e.key === " " ? { open: true }
    : e.key === "ArrowLeft" ? { days: -1, minutes: 0 }
    : e.key === "ArrowRight" ? { days: 1, minutes: 0 }
    : e.key === "ArrowUp" ? up
    : e.key === "ArrowDown" ? { days: -up.days, minutes: -up.minutes }
    : null;
  if (k) e.preventDefault();
  return k;
}

/**
 * Keeps the keyboard on an item that a key just moved: a move to another day
 * draws it afresh in that day's column, and the focus would fall to the page.
 * For a moment after the write it puts the focus on the element carrying
 * `data-focus-key={key}` whenever the focus has nowhere else to be.
 */
export function keepFocus(key: string, ms = 1500) {
  const until = performance.now() + ms;
  const sel = `[data-focus-key="${CSS.escape(key)}"]`;
  const tick = () => {
    const active = document.activeElement;
    if (!active || active === document.body) document.querySelector<HTMLElement>(sel)?.focus();
    if (performance.now() < until) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/**
 * Closing what an item on the hours opened (its Peek, its read-only card)
 * hands the focus back to the item (#284), as a menu does to its trigger; an
 * item redrawn elsewhere is found again by its `data-focus-key`. A focus
 * already taken by something outside the content stays where it went, and with
 * no item (`anchor()` null) the content's own return holds. Spread the result
 * on the Sheet's or Popover's content.
 */
export function useReturnToItem(anchor: () => HTMLElement | null) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseAutoFocus = (e: Event) => {
    const item = anchor();
    const active = document.activeElement;
    if (!item || (active && active !== document.body && !ref.current?.contains(active))) return;
    e.preventDefault();
    if (item.isConnected) item.focus({ preventScroll: true });
    else if (item.dataset.focusKey) keepFocus(item.dataset.focusKey);
  };
  return { ref, onCloseAutoFocus };
}
