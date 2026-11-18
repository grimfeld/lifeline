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
  /** The Estimate (ADR 0054): whole minutes the App expects it to take. null/absent = none given yet. */
  estimateMin?: number | null;
  /**
   * A small mark Surfaces put before the title, saying what the item belongs
   * to — a Task's Project's face (ADR 0060). One emoji or letter, optionally
   * coloured.
   */
  mark?: { text: string; color?: string };
}

/**
 * A work item as the hours show it: a Time block (a placement with a start,
 * ADR 0028) or an untimed chip (no placement, or one without a start).
 */
export type WorkOnHours = Pick<SchedulableItem, "appId" | "itemId" | "title" | "date" | "completedOn" | "estimateMin"> & {
  color?: string;
  displayDate?: DateStr;
  placementId?: string;
  start?: string | null;
  end?: string | null;
};

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
  /**
   * The same items, read once outside React — what an agent reads (ADR 0062),
   * as Push reads a Timed provider's `itemsIn`. A provider without it is
   * invisible to callers that have no React tree.
   */
  itemsIn?(range: { start: DateStr; end: DateStr }): Promise<SchedulableItem[]>;
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
  /**
   * Optional delegate of "the user gave this item an Estimate" (ADR 0054).
   * An App that implements it reports `estimateMin` on its items and earns
   * them a Push; an App without it gets none, since Push must be able to
   * keep the Estimate it asks for.
   */
  setEstimate?(itemId: string, minutes: number): Promise<void>;
  /**
   * The Document whose Peek opens when the item's Time block or untimed chip
   * is tapped on the hours (#537): a Task's own, an Occurrence's Task. The Peek
   * draws the block's timing above the App's part. null, or no hook, means
   * the item has no Document: a tap shows a small read-only card (#538).
   */
  peekOf?(itemId: string): string | null;
  /** Optional route that opens the item where its App edits it in full. */
  href?(itemId: string): string;
}
