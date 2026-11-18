import {
  addTimeBlock,
  canMoveTimed,
  canRescheduleTimed,
  completeSurfaceItem,
  forgetTiming,
  moveTimeBlock,
  moveTimedItem,
  noteTiming,
  onPeekClosed,
  removeTimeBlock,
  removeTimedItem,
  rescheduleTimedItem,
  timedTimingKey,
  unplaceItem,
  wholeWhenOf,
  type DateStr,
  type HoursTapped,
  type TimedItem,
  type TimedWhen,
  type TimeStr,
  type WholeWhen,
  type WorkOnHours,
} from "@lifeline/core";
import { blockEnd, blockOfTapped, type BlockTime } from "./blockTiming";
import { contractWhen, timedControls } from "./timedTiming";
import { toastWriteFailed, writeQueue, type WriteQueue } from "./writeQueue";

/**
 * A Peek's **visit**: one tap on the hours, until the Peek closes. Its timing
 * state lives here, keyed by what was tapped, not in the timing section: following
 * a link in the Peek unmounts the section and Back mounts it again, and it must
 * go on from where the visit was — the block it made, the time it last wrote —
 * not from the item as it was first tapped (F1). Closing the Peek ends every visit.
 */
const visits = new Map<HoursTapped, BlockVisit | TimedVisit>();
onPeekClosed(() => visits.clear());

/** A block's day and hours, as the placement operations take them. */
type Span = { start: TimeStr; end: TimeStr };

/** The placement operations a block visit writes through (ADR 0028); a test passes its own. */
export interface BlockOps {
  add: (appId: string, itemId: string, date: DateStr, span: Span) => Promise<string>;
  move: (placementId: string, date: DateStr, span: Span) => Promise<unknown>;
  unplace: (placementId: string) => Promise<unknown>;
  /** Complete the item (by its item id, so an Occurrence of a recurring Task is the one done); the placements it cleared. */
  complete: (appId: string, itemId: string) => Promise<readonly string[]>;
  remove: (placementId: string) => Promise<() => Promise<unknown>>;
}

const placementOps: BlockOps = { add: addTimeBlock, move: moveTimeBlock, unplace: unplaceItem, complete: (appId, itemId) => completeSurfaceItem({ appId, itemId }), remove: removeTimeBlock };

/** A Time block's timing as the Peek's Undo knows it. */
type Placed = Span & { date: DateStr };
const placed = (b: BlockTime & { start: string }): Placed => ({ date: b.date, start: b.start, end: blockEnd(b) });

/** A work item's visit (#537): the block that was tapped, or the one this visit made from a chip. */
export interface BlockVisit {
  readonly kind: "work";
  readonly time: BlockTime;
  readonly hasBlock: boolean;
  /** Whether this visit completed the item. */
  readonly completed: boolean;
  /** Complete the item once the writes so far are done; false when it failed (the queue says so). */
  complete: () => Promise<boolean>;
  /** Write a new timing at once, noted to the Peek for its one Undo; a chip's first start makes its block. */
  write: (next: BlockTime) => void;
  /** Remove the block, with an Undo of its own (null when none was written); the item and its chip stay. */
  remove: () => Promise<(() => Promise<unknown>) | null>;
  /** Every write queued so far, done. */
  settled: () => Promise<void>;
}

/** The visit of a tapped work item: the same one again while the Peek stays open. */
export function blockVisit(tapped: HoursTapped & { kind: "work" }, today: DateStr, ops: BlockOps = placementOps, failed: (e: unknown) => void = toastWriteFailed): BlockVisit {
  const known = visits.get(tapped);
  if (known?.kind === "work") return known;
  const visit = newBlockVisit(tapped.item, blockOfTapped(tapped.item, today), ops, failed);
  visits.set(tapped, visit);
  return visit;
}

function newBlockVisit(item: WorkOnHours, initial: BlockTime, ops: BlockOps, failed: (e: unknown) => void): BlockVisit {
  const queue: WriteQueue = writeQueue(failed);
  let time = initial;
  let blockId: string | null = item.placementId && item.start ? item.placementId : null;
  let hasBlock = blockId !== null;
  let completed = false;
  /** The block this visit made from the chip, until it is removed. */
  let made = false;
  const timingKey = () => (made || !item.placementId ? `block:chip:${item.appId}/${item.itemId}` : `block:${item.placementId}`);

  return {
    kind: "work",
    get time() {
      return time;
    },
    get hasBlock() {
      return hasBlock;
    },
    get completed() {
      return completed;
    },
    settled: queue.settled,
    async complete() {
      const unplaced = await queued(queue, () => ops.complete(item.appId, item.itemId));
      if (unplaced === null) return false;
      completed = true;
      // Completing clears the blocks still ahead: the visit no longer has one to time or put back.
      if (blockId && unplaced.includes(blockId)) {
        forgetTiming(timingKey());
        blockId = null;
        hasBlock = false;
        time = { ...time, start: null };
      }
      return true;
    },
    write(next) {
      time = next;
      // An untimed chip only chooses where its block will land until it has a start.
      if (!next.start) return;
      const at = placed({ ...next, start: next.start });
      const span = { start: at.start, end: at.end };
      if (hasBlock) {
        queue.run(async () => {
          if (blockId) await ops.move(blockId, next.date, span);
        });
      } else {
        made = true;
        hasBlock = true;
        queue.run(async () => {
          blockId = await ops.add(item.appId, item.itemId, next.date, span);
        });
      }
      const before = initial.start && !made ? placed({ ...initial, start: initial.start }) : null;
      noteTiming<Placed | null>({
        key: timingKey(),
        label: item.title,
        before,
        after: at,
        restore: async () => {
          await queue.settled();
          if (!blockId) return;
          if (before) await ops.move(blockId, before.date, { start: before.start, end: before.end });
          else await ops.unplace(blockId);
        },
      });
    },
    remove() {
      // Removing has its own Undo: the visit's timing Undo no longer covers it.
      forgetTiming(timingKey());
      hasBlock = false;
      time = { ...time, start: null };
      return queued(queue, async () => {
        const id = blockId;
        blockId = null;
        return id ? ops.remove(id) : null;
      });
    },
  };
}

/** Run `act` after the writes queued so far; its result, or null when it failed (the queue says so). */
function queued<U>(queue: WriteQueue, act: () => Promise<U>): Promise<U | null> {
  return new Promise((resolve) =>
    queue.run(async () => {
      try {
        resolve(await act());
      } catch (e) {
        resolve(null);
        throw e;
      }
    }),
  );
}

/** The Timed hooks a Timed item's visit writes through (ADR 0056); a test passes its own. */
export interface TimedOps {
  /** Write a new when: the whole of it where the App reschedules, its day where it only moves. */
  put: (w: WholeWhen) => Promise<unknown>;
  /** Delete the item, with the Undo its App gives. */
  remove: () => Promise<() => Promise<unknown>>;
}

/** The item's own App's hooks, as far as it allows (`timedControls`). */
export function timedOpsOf(item: TimedItem): TimedOps {
  const controls = timedControls(item, { reschedule: canRescheduleTimed(item.appId), move: canMoveTimed(item.appId) });
  return {
    put: (w) => (controls === "retime" ? rescheduleTimedItem(item, contractWhen(w)) : moveTimedItem(item, w.date)),
    remove: () => removeTimedItem(item),
  };
}

/** A Timed item's visit (#538): its when as last written. */
export interface TimedVisit {
  readonly kind: "timed";
  readonly when: WholeWhen;
  /** Write a new when at once, noted to the Peek for its one Undo. */
  write: (next: WholeWhen) => void;
  /** Delete the item once the writes are done, with the Undo its App gives (null if it failed). */
  remove: () => Promise<(() => Promise<unknown>) | null>;
  /** Every write queued so far, done. */
  settled: () => Promise<void>;
}

/** The visit of a tapped Timed item: the same one again while the Peek stays open. */
export function timedVisit(tapped: HoursTapped & { kind: "timed" }, ops: TimedOps = timedOpsOf(tapped.item), failed: (e: unknown) => void = toastWriteFailed): TimedVisit {
  const known = visits.get(tapped);
  if (known?.kind === "timed") return known;
  const item = tapped.item;
  const initial = wholeWhenOf(item);
  const queue = writeQueue(failed);
  let when = initial;
  const key = timedTimingKey(item);
  const visit: TimedVisit = {
    kind: "timed",
    get when() {
      return when;
    },
    settled: queue.settled,
    write(next) {
      when = next;
      queue.run(() => ops.put(next));
      noteTiming<TimedWhen>({
        key,
        label: item.title,
        before: contractWhen(initial),
        after: contractWhen(next),
        restore: async () => {
          await queue.settled();
          await ops.put(initial);
        },
      });
    },
    remove() {
      // Deleting has its own Undo: the visit's timing Undo no longer covers it.
      forgetTiming(key);
      return queued(queue, ops.remove);
    },
  };
  visits.set(tapped, visit);
  return visit;
}
