import type { DateStr } from "../dates";

export type Urgency = "overdue" | "due-today" | "upcoming" | "none";

/** An App entity projected onto a time surface. */
export interface SchedulableItem {
  /** `${appId}/${itemId}` — unique across Apps. */
  key: string;
  appId: string;
  itemId: string;
  title: string;
  subtitle?: string;
  /** Natural day the item wants doing (due/planned). null = unplaced pool. */
  date: DateStr | null;
  urgency: Urgency;
  /** Set when the current cycle/occurrence is already done. */
  completedOn?: DateStr | null;
  /** The entity's Tags (ADR 0014); Occurrences inherit their Task's. */
  tags?: string[];
}

/**
 * The Schedulable Contract (ADR 0001): surfaces render items from every
 * provider, but all semantics — what completing means, what happens when a
 * day passes uncompleted — belong to the owning App.
 */
export interface SchedulableProvider {
  appId: string;
  /**
   * React hook. Live items whose display date falls in [start, end],
   * plus overdue items regardless of range.
   */
  useItems(range: { start: DateStr; end: DateStr }): SchedulableItem[];
  /** Delegate of "the user ticked this off on a surface". */
  complete(itemId: string, on: DateStr): Promise<void>;
  /**
   * Optional delegate of "the user dragged this to another day (or back to
   * the unplaced pool: null)". When implemented, a move changes the App's
   * own state; when absent, surfaces fall back to a Core Placement pin.
   */
  move?(itemId: string, to: DateStr | null): Promise<void>;
  /**
   * Behavior when an item's day passes uncompleted:
   * "roll-forward" — surfaces show it on today until done (chores);
   * "stay" — it stays where it was and reads as missed.
   */
  overduePolicy: "roll-forward" | "stay";
}
