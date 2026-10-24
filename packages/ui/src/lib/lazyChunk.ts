import { lazy, type ComponentType } from "react";

/** Every chunk loaded on first use, to fetch ahead once the page is idle. */
const loaders = new Set<() => Promise<unknown>>();

/**
 * `React.lazy`, and the chunk joins the ones fetched ahead after first paint
 * (ADR 0099). The first load stays light, and a page that has loaded keeps
 * working offline: with no service worker, a chunk never fetched could not
 * load once the network is gone.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- React.lazy's own bound: a component of any props
export function lazyChunk<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  loaders.add(load);
  return lazy(load);
}

/** A chunk loaded on use that is no component (ical.js): fetched ahead with the rest. */
export function preloadLater(load: () => Promise<unknown>): void {
  loaders.add(load);
}

/** Fetch every registered chunk, one after another so first-use loads are not starved. A failure is left for first use. */
export async function preloadLazyChunks(): Promise<void> {
  for (const load of loaders) {
    try {
      await load();
    } catch {
      // Offline or a stale deploy: the chunk loads, or fails visibly, when it is used.
    }
  }
}
