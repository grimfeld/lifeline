import { liveQuery, type Subscription } from "dexie";
import { useSyncExternalStore } from "react";

/**
 * One Dexie live query shared by every component that reads it: a single
 * subscription, one result array identity per emission. `useLiveQuery` gives
 * each mount its own query and its own array, so anything memoised on the
 * result (the link index) would rebuild once per consumer per change.
 */
export function sharedLiveQuery<T>(query: () => Promise<T>, initial: T): { use(): T; peek(): T } {
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
  const subscribe = (l: () => void) => {
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
