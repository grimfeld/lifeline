import { createContext, useContext, useSyncExternalStore } from "react";
import { MODULES } from "../manifest";
import { appById, moduleOfPath } from "../registry";
import { docHref } from "./href";
import { documentTypeSync } from "./registry";
import type { Document } from "./types";
import type { WorkOnHours } from "../contracts/schedulable";
import type { TimedItem } from "../contracts/timed";

/**
 * A Document's **Home Module** (ADR 0057): its type's owning App's Module —
 * where it opens all the way. Undefined for a user-defined type (no owning
 * App) and for a type whose App names no Module (the Calendar App's Events).
 */
export function homeModuleOf(doc: Pick<Document, "type">): string | undefined {
  const def = documentTypeSync(doc.type);
  const appId = def?.appId;
  const m = appId ? appById(appId)?.module : def?.homeModule;
  return m && MODULES.some((x) => x.id === m) ? m : undefined;
}

/**
 * Whether opening a Document from `pathname` goes straight to it rather than
 * **peeking**: only when the user already stands in its Home Module. From
 * anywhere else — another Module, a general Surface, a Base, the Vault for a
 * Document that is not Note-taking's — interconnection must not throw the user
 * out of what they were doing, so the owner's small view opens where they are.
 */
export function opensInPlace(doc: Pick<Document, "type">, pathname: string): boolean {
  const home = homeModuleOf(doc);
  return !!home && home === moduleOfPath(pathname);
}

// --- the one Peek open at a time, and its back stack (a module-level store, like the current Workspace) ---

/**
 * What was tapped on the hours to open a Peek (#536): a Timed item (an Event, a
 * Time blocker band, another App's item), or a work item's Time block or
 * untimed chip. The Peek draws the timing of what was tapped above the App's
 * part — for an Event its Form's day and time Fields already are that timing.
 */
export type HoursTapped = { kind: "timed"; item: TimedItem & { color?: string } } | { kind: "work"; item: WorkOnHours };

/** Where a Peek was opened from; empty for a Peek opened from anywhere but the hours. */
export interface PeekOrigin {
  /** What was tapped on the hours; the Peek knows it only while it shows the Document it was opened on. */
  tapped?: HoursTapped;
  /** The element the Peek was opened from: closing hands the focus back to it (#284). */
  anchor?: HTMLElement | null;
}

/**
 * What the Peek has shown, oldest first; the last is what it shows now.
 * Following a link inside a Peek replaces what it shows, with a way back
 * (ADR 0085): a Peek never opens over another Peek.
 */
let stack: readonly string[] = [];
/** Where the open (or last closed) Peek came from: kept after closing, so the focus can go back. */
let origin: PeekOrigin = {};
const listeners = new Set<() => void>();

function set(next: readonly string[]) {
  stack = next;
  listeners.forEach((l) => l());
}

/**
 * Peek a Document from the page: the owning App's small view, opened over
 * wherever the user is. Starts a new stack — and ends the Peek it replaces, with
 * its timing Undo. The hours say what was tapped and where (`from`).
 */
export function openPeek(docId: string, from: PeekOrigin = {}): void {
  if (stack.length) endTiming();
  origin = from;
  set([docId]);
}

/** Follow a link inside a Peek: it shows `docId` instead, and back returns. Starts a Peek when none is open. */
export function pushPeek(docId: string): void {
  if (stack[stack.length - 1] === docId) return;
  if (!stack.length) origin = {};
  set([...stack, docId]);
}

/** Back to what the Peek showed before; on the first Document of the stack, nothing. */
export function backPeek(): void {
  if (stack.length > 1) set(stack.slice(0, -1));
}

/** Close the Peek: the timing changed while it was open is handed to `onPeekClosed`'s listeners, for one Undo. */
export function closePeek(): void {
  if (!stack.length) return;
  set([]);
  endTiming();
}

/** Where the Peek was opened from, outside React — the last one's once closed. */
export function peekOrigin(): PeekOrigin {
  return origin;
}

/** What was tapped on the hours, while the Peek shows the Document it was opened on; else null. */
export function peekTapped(): HoursTapped | null {
  return stack.length && stack[stack.length - 1] === stack[0] ? (origin.tapped ?? null) : null;
}

// --- the timing Undo (ADR 0056, the Peek's since #536) ---

/**
 * A timing changed inside the Peek: an Event's day and times, a block's start
 * and length. Whoever writes it notes it (`noteTiming`); closing the Peek hands
 * over every one that still differs, and puts each back with `restore` on Undo.
 */
export interface TimingChange<T = unknown> {
  /** One per thing timed (`event:<id>`, `block:<placementId>`): later notes of it keep the first `before`. */
  key: string;
  /** Its name, for the Undo's toast. */
  label: string;
  /** Its timing before the first change while the Peek was open. */
  before: T;
  /** Its timing as last written. */
  after: T;
  /** Puts `before` back: the first note's is kept, with its `before`. */
  restore: () => Promise<unknown>;
}

let timing = new Map<string, TimingChange>();
const closedListeners = new Set<(changes: TimingChange[]) => void>();

/** Plain values the same, whatever the order of their keys. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** Note a timing written inside the open Peek; outside a Peek, nothing. The first note of a key keeps its `before`. */
export function noteTiming<T>(change: TimingChange<T>): void {
  if (!stack.length) return;
  const first = timing.get(change.key);
  timing.set(change.key, first ? { ...first, label: change.label, after: change.after } : change);
}

/** Drop what was noted for a key: the thing was deleted, with an Undo of its own. */
export function forgetTiming(key: string): void {
  timing.delete(key);
}

/** Listen for Peeks closing (or replaced by another): with the timing changes that still differ, empty when none. */
export function onPeekClosed(listener: (changes: TimingChange[]) => void): () => void {
  closedListeners.add(listener);
  return () => {
    closedListeners.delete(listener);
  };
}

function endTiming() {
  const changes = [...timing.values()].filter((c) => !same(c.before, c.after));
  timing = new Map();
  closedListeners.forEach((l) => l(changes));
}

/** What the Peek has shown, oldest first, outside React. */
export function peekStack(): readonly string[] {
  return stack;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const EMPTY: readonly string[] = [];

/** What the Peek has shown, oldest first; empty when it is closed. */
export function usePeekStack(): readonly string[] {
  return useSyncExternalStore(subscribe, peekStack, () => EMPTY);
}

/** The id of the Document being peeked, or null. */
export function usePeekedId(): string | null {
  return useSyncExternalStore(
    subscribe,
    () => stack[stack.length - 1] ?? null,
    () => null,
  );
}

/**
 * Whether this part of the page is inside the Peek: the Peek's host provides
 * `true`, so a link followed in there replaces what the Peek shows rather than
 * opening a new Peek or leaving the page.
 */
export const InPeekContext = createContext(false);

export function useInPeek(): boolean {
  return useContext(InPeekContext);
}

/** Peek a Document from here: inside a Peek it replaces what the Peek shows, from the page it opens a new one. */
export function useOpenPeek(): (docId: string) => void {
  return useInPeek() ? pushPeek : openPeek;
}

/**
 * Open a Document the way a link, a backlink or a search hit should (ADR
 * 0057): go to it inside its Home Module, peek it from anywhere else — and
 * from inside a Peek, show it in that Peek (ADR 0085), whose own way through
 * leads to the Home Module. Core holds no router, so the caller hands in where
 * it is and how to move.
 */
export function openDocument(doc: Document, at: { pathname: string; navigate: (to: string) => void; inPeek?: boolean }): void {
  if (at.inPeek) pushPeek(doc.id);
  else if (opensInPlace(doc, at.pathname)) at.navigate(docHref(doc));
  else openPeek(doc.id);
}
