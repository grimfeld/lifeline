import { addTimeBlock, forgetTiming, moveTimeBlock, noteTiming, onPeekClosed, removeTimeBlock, unplaceItem, type HoursTapped, type TimedWhen, type WorkOnHours } from "@lifeline/core";
import { blockEnd, blockOfTapped, type BlockTime } from "./blockTiming";
import { contractWhen, timedWhenOf, type WhenTime } from "./timedTiming";
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

/** The placement operations a block visit writes through (ADR 0028); a test passes its own. */
export interface BlockOps {
  add: (appId: string, itemId: string, date: string, span: { start: string; end: string }) => Promise<string>;
  move: (placementId: string, date: string, span: { start: string; end: string }) => Promise<unknown>;
  unplace: (placementId: string) => Promise<unknown>;
  remove: (placementId: string) => Promise<() => Promise<unknown>>;
  /** A write that failed: the queue carries on. */
  failed: (e: unknown) => void;
}

const placementOps: BlockOps = { add: addTimeBlock, move: moveTimeBlock, unplace: unplaceItem, remove: removeTimeBlock, failed: toastWriteFailed };

/** A Time block's timing as the Peek's Undo knows it. */
type Placed = { date: string; start: string; end: string };
const placed = (b: BlockTime & { start: string }): Placed => ({ date: b.date, start: b.start, end: blockEnd(b) });

/** A work item's visit (#537): the block that was tapped, or the one this visit made from a chip. */
export interface BlockVisit {
  readonly time: BlockTime;
  readonly hasBlock: boolean;
  /** Write a new timing at once, noted to the Peek for its one Undo; a chip's first start makes its block. */
  write: (next: BlockTime) => void;
  /** Remove the block, with an Undo of its own (null when none was written); the item and its chip stay. */
  remove: () => Promise<(() => Promise<unknown>) | null>;
  /** Every write queued so far, done. */
  settled: () => Promise<void>;
}

/** The visit of a tapped work item: the same one again while the Peek stays open. */
export function blockVisit(tapped: HoursTapped & { kind: "work" }, today: string, ops: BlockOps = placementOps): BlockVisit {
  const known = visits.get(tapped);
  if (known && "hasBlock" in known) return known;
  const visit = newBlockVisit(tapped.item, blockOfTapped(tapped.item, today), ops);
  visits.set(tapped, visit);
  return visit;
}

function newBlockVisit(item: WorkOnHours, initial: BlockTime, ops: BlockOps): BlockVisit {
  const queue: WriteQueue = writeQueue(ops.failed);
  let time = initial;
  let blockId: string | null = item.placementId && item.start ? item.placementId : null;
  let hasBlock = blockId !== null;
  /** The block this visit made from the chip, until it is removed. */
  let made = false;
  const timingKey = () => (made || !item.placementId ? `block:chip:${item.appId}/${item.itemId}` : `block:${item.placementId}`);

  return {
    get time() {
      return time;
    },
    get hasBlock() {
      return hasBlock;
    },
    settled: queue.settled,
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

/** A Timed item's visit (#538): its when as last written. */
export interface TimedVisit {
  readonly when: WhenTime;
  /** Write a new when at once through `put` (its App's hook), noted to the Peek for its one Undo. */
  write: (next: WhenTime, put: (w: WhenTime) => Promise<unknown>) => void;
  /** Delete the item through `del` once the writes are done, with the Undo `del` gives (null if it failed). */
  remove: <U>(del: () => Promise<U>) => Promise<U | null>;
  /** Every write queued so far, done. */
  settled: () => Promise<void>;
}

/** The visit of a tapped Timed item: the same one again while the Peek stays open. */
export function timedVisit(tapped: HoursTapped & { kind: "timed" }, failed: (e: unknown) => void = toastWriteFailed): TimedVisit {
  const known = visits.get(tapped);
  if (known && "when" in known) return known;
  const item = tapped.item;
  const initial = timedWhenOf(item);
  const queue = writeQueue(failed);
  let when = initial;
  const key = `timed:${item.appId}/${item.itemId}`;
  const visit: TimedVisit = {
    get when() {
      return when;
    },
    settled: queue.settled,
    write(next, put) {
      when = next;
      queue.run(() => put(next));
      noteTiming<TimedWhen>({
        key,
        label: item.title,
        before: contractWhen(initial),
        after: contractWhen(next),
        restore: async () => {
          await queue.settled();
          await put(initial);
        },
      });
    },
    remove(del) {
      // Deleting has its own Undo: the visit's timing Undo no longer covers it.
      forgetTiming(key);
      return queued(queue, del);
    },
  };
  visits.set(tapped, visit);
  return visit;
}
