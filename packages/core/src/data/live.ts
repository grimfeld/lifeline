import { liveQuery, type Subscription } from "dexie";
import { useSyncExternalStore } from "react";

/**
 * One Dexie live query shared by every component that reads it: a single
 * subscription, one result array identity per emission. `useLiveQuery` gives
 * each mount its own query and its own array, so anything memoised on the
 * result (the link index) would rebuild once per consumer per change.
 *
 * `restartOn` names a signal the query depends on that Dexie cannot see — the
 * current Workspace lives in memory, not in a table — and re-runs the query
 * whenever it fires. Pass the querier as an `async` function: Dexie keeps its
 * liveQuery zone across native awaits only for an AsyncFunction (see
 * `useWorkspaceScreens`).
 */
export function sharedLiveQuery<T>(
  query: () => Promise<T>,
  initial: T,
  opts?: { restartOn?: (cb: () => void) => unknown },
): { use(): T; peek(): T } {
  let value = initial;
  let sub: Subscription | null = null;
  const listeners = new Set<() => void>();
  const start = () => {
    if (sub) return;
    try {
      sub = liveQuery(query).subscribe({
        next: (v) => {
          value = v;
          listeners.forEach((l) => l());
        },
        error: () => {
          /* keep the last value */
        },
      });
    } catch {
      sub = null; // db not open yet; retry on the next subscribe
    }
  };
  // Listen for restarts on first read, not at creation: these queries are
  // module-level constants, and the signal's own module may still be
  // initialising in an import cycle (workspaces.ts → registry → store.ts).
  let listening = false;
  const subscribe = (l: () => void) => {
    if (!listening && opts?.restartOn) {
      listening = true;
      opts.restartOn(() => {
        if (!sub) return; // nobody is reading; the next subscribe starts fresh
        sub.unsubscribe();
        sub = null;
        start();
      });
    }
    listeners.add(l);
    start();
    return () => {
      listeners.delete(l);
      if (listeners.size === 0 && sub) {
        sub.unsubscribe();
        sub = null;
      }
    };
  };
  return {
    use: () => useSyncExternalStore(subscribe, () => value),
    peek: () => value,
  };
}
