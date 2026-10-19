import { createContext, useContext, useSyncExternalStore } from "react";
import { MODULES } from "../manifest";
import { appById, moduleOfPath } from "../registry";
import { docHref } from "./href";
import { documentTypeSync } from "./registry";
import type { Document } from "./types";

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
 * What the Peek has shown, oldest first; the last is what it shows now.
 * Following a link inside a Peek replaces what it shows, with a way back
 * (ADR 0085): a Peek never opens over another Peek.
 */
let stack: readonly string[] = [];
const listeners = new Set<() => void>();

function set(next: readonly string[]) {
  stack = next;
  listeners.forEach((l) => l());
}

/** Peek a Document from the page: the owning App's small view, opened over wherever the user is. Starts a new stack. */
export function openPeek(docId: string): void {
  set([docId]);
}

/** Follow a link inside a Peek: it shows `docId` instead, and back returns. Starts a Peek when none is open. */
export function pushPeek(docId: string): void {
  if (stack[stack.length - 1] === docId) return;
  set([...stack, docId]);
}

/** Back to what the Peek showed before; on the first Document of the stack, nothing. */
export function backPeek(): void {
  if (stack.length > 1) set(stack.slice(0, -1));
}

export function closePeek(): void {
  if (stack.length) set([]);
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
