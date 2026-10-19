import { useSyncExternalStore } from "react";
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

// --- the one Peek open at a time (a module-level store, like the current Workspace) ---

let peeked: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Peek a Document: the owning App's small view, opened over wherever the user is. */
export function openPeek(docId: string): void {
  peeked = docId;
  emit();
}

export function closePeek(): void {
  if (peeked === null) return;
  peeked = null;
  emit();
}

/** The id of the Document being peeked, or null. */
export function usePeekedId(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => peeked,
    () => null,
  );
}

/**
 * Open a Document the way a link, a backlink or a search hit should (ADR
 * 0057): go to it inside its Home Module, peek it from anywhere else. Core
 * holds no router, so the caller hands in where it is and how to move.
 */
export function openDocument(doc: Document, at: { pathname: string; navigate: (to: string) => void }): void {
  if (opensInPlace(doc, at.pathname)) at.navigate(docHref(doc));
  else openPeek(doc.id);
}
