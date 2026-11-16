import { useRef } from "react";
import { toast } from "@lifeline/ui";

/**
 * A Peek's timing writes, run one after another (#537, #538): a quick second
 * nudge must not race the block or the move the first one made. A write that
 * fails says so in a toast and the queue carries on. `settled` waits for every
 * write queued so far — an Undo puts the timing back only after them.
 */
export function useWriteQueue(): { run: (write: () => Promise<unknown>) => void; settled: () => Promise<void> } {
  const queue = useRef<Promise<void>>(Promise.resolve());
  return {
    run: (write) => {
      queue.current = queue.current.then(() => write()).then(
        () => undefined,
        (e: unknown) => void toast.error(`Could not save: ${e instanceof Error ? e.message : String(e)}`),
      );
    },
    settled: () => queue.current,
  };
}
