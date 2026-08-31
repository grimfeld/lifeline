import { useSyncExternalStore } from "react";

/**
 * Per-device sidebar preferences (grill 2026-08-20): which sections are
 * collapsed, which Nav groups are open and which Bases are hidden.
 * Deliberately localStorage, never synced — each device curates its own
 * sidebar; hiding a Base changes the sidebar only (the Base stays reachable
 * via /base and its URL).
 */

const COLLAPSED_KEY = "lifeline.sidebar.collapsed";
const HIDDEN_BASES_KEY = "lifeline.sidebar.hiddenBases";
const OPEN_GROUPS_KEY = "lifeline.sidebar.openGroups";
const KEYS = [COLLAPSED_KEY, HIDDEN_BASES_KEY, OPEN_GROUPS_KEY];

const cache = new Map<string, string[]>();
const listeners = new Set<() => void>();

function read(key: string): string[] {
  let v = cache.get(key);
  if (!v) {
    try {
      const raw = localStorage.getItem(key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      v = Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      v = [];
    }
    cache.set(key, v);
  }
  return v;
}

function write(key: string, value: string[]) {
  cache.set(key, value);
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. — keep the in-memory value */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => {
    if (e.key && KEYS.includes(e.key)) {
      cache.delete(e.key);
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

function useStoredList(key: string): [string[], (item: string) => void] {
  const list = useSyncExternalStore(subscribe, () => read(key));
  const toggle = (item: string) => {
    const cur = read(key);
    write(key, cur.includes(item) ? cur.filter((x) => x !== item) : [...cur, item]);
  };
  return [list, toggle];
}

/** Add one item to a stored list, if it isn't there already (idempotent — safe to call from an effect). */
function add(key: string, item: string) {
  const cur = read(key);
  if (!cur.includes(item)) write(key, [...cur, item]);
}

/** Collapsed sidebar section ids ("screens" | "surfaces" | "apps" | "bases"). */
export function useCollapsedSections(): [string[], (id: string) => void] {
  return useStoredList(COLLAPSED_KEY);
}

/** Document type ids whose Bases are hidden from the sidebar on this device. */
export function useHiddenBases(): [string[], (typeId: string) => void] {
  return useStoredList(HIDDEN_BASES_KEY);
}

/**
 * Nav groups open on this device. Groups start closed — the point of grouping
 * is a short sidebar — and `reveal` opens the one holding the current screen,
 * so navigating anywhere (palette, link, deep URL) shows where you landed.
 */
export function useOpenGroups(): { open: string[]; toggle: (id: string) => void; reveal: (id: string) => void } {
  const open = useSyncExternalStore(subscribe, () => read(OPEN_GROUPS_KEY));
  return {
    open,
    toggle: (id) => {
      const cur = read(OPEN_GROUPS_KEY);
      write(OPEN_GROUPS_KEY, cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
    },
    reveal: (id) => add(OPEN_GROUPS_KEY, id),
  };
}
