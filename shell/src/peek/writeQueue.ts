import { toast } from "@lifeline/ui";

export interface WriteQueue {
  run: (write: () => Promise<unknown>) => void;
  settled: () => Promise<void>;
}

/** Says a write failed; the queue carries on. */
export const toastWriteFailed = (e: unknown) => void toast.error(`Could not save: ${e instanceof Error ? e.message : String(e)}`);

/**
 * A Peek's timing writes, run one after another (#537, #538): a quick second
 * nudge must not race the block or the move the first one made. A write that
 * fails goes to `failed` and the queue carries on. `settled` waits for every
 * write queued so far — an Undo puts the timing back only after them.
 */
export function writeQueue(failed: (e: unknown) => void = toastWriteFailed): WriteQueue {
  let queue: Promise<void> = Promise.resolve();
  return {
    run: (write) => {
      queue = queue.then(() => write()).then(() => undefined, failed);
    },
    settled: () => queue,
  };
}
