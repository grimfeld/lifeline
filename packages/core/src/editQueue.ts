/**
 * A queue that runs edits one after another: each starts once the one before
 * has finished, failed or not, so it reads the Document as the last edit left
 * it. Two changes made in quick succession — a Peek closed with two Fields
 * typed in — then never write back each other's old value. Each edit's own
 * promise still rejects for its caller.
 */
export function editQueue(): <T>(run: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return (run) => {
    const next = tail.then(run);
    tail = next.catch(() => undefined);
    return next;
  };
}
