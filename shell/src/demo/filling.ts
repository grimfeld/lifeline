import { useSyncExternalStore } from "react";

/**
 * Whether the Demo life is still being written behind the first screen
 * (`./seed`). In the main bundle, so the shell can say so without loading the
 * life.
 */
let filling = false;
const listeners = new Set<() => void>();

export function setDemoFilling(on: boolean): void {
  if (on === filling) return;
  filling = on;
  listeners.forEach((l) => l());
}

export function useDemoFilling(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => filling,
  );
}
