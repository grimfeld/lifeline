import { useCallback, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { docHref, openDocument, openPrivateDialog, putDocument, useInPeek, useOpenPeek, type Document, type LinkIndex, type LinkRef } from "@lifeline/core";
import { toast } from "@lifeline/ui";

/**
 * Opens a Document the way a link should (ADR 0057): inside its Home Module
 * it goes there, from anywhere else it **peeks** — the owner's small view over
 * where the user is — and inside a Peek it replaces what the Peek shows (ADR 0085).
 */
export function useOpenDocument(): (doc: Document) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inPeek = useInPeek();
  return useCallback((doc: Document) => openDocument(doc, { pathname, navigate, inPeek }), [pathname, navigate, inPeek]);
}

/**
 * Peeks a link (`Ctrl+Enter` in the editor, ADR 0085): a Document opens in the
 * Peek whatever its Home Module, a link behind the Private lock asks to
 * unlock, and an unresolved name is left alone — peeking makes nothing.
 */
export function usePeekLinkRef(index: LinkIndex): (ref: LinkRef, name: string) => void {
  const peek = useOpenPeek();
  return useCallback(
    (ref: LinkRef) => {
      if (ref.kind === "doc") {
        if (index.byId.has(ref.id)) peek(ref.id);
      } else if (ref.kind === "locked") openPrivateDialog("unlock");
    },
    [index, peek],
  );
}

/**
 * Follows a link the way the editor does: a Document opens (or peeks), a link
 * behind the Private lock asks to unlock, and an unresolved name is created —
 * as a Thought unless the caller says otherwise — and opened.
 */
export function useOpenLinkRef(index: LinkIndex, onCreateUnresolved?: (name: string) => void): (ref: LinkRef, name: string) => void {
  const navigate = useNavigate();
  const openDoc = useOpenDocument();
  return useCallback(
    (ref: LinkRef, name: string) => {
      if (ref.kind === "doc") {
        const d = index.byId.get(ref.id);
        if (d) openDoc(d);
        return;
      }
      if (ref.kind === "locked") return openPrivateDialog("unlock");
      if (onCreateUnresolved) return onCreateUnresolved(name);
      putDocument({ type: "thought", title: name, body: "" }).then(
        (n) => {
          toast.success(`Created “${name}”`);
          navigate(docHref(n));
        },
        (err: unknown) => toast.error(`Couldn’t create “${name}” — ${err instanceof Error ? err.message : String(err)}`),
      );
    },
    [index, navigate, openDoc, onCreateUnresolved],
  );
}

/**
 * A link to a Document that follows `useOpenDocument`: a plain click opens it
 * in place or peeks it, while a modified click (new tab, new window) keeps the
 * real route, which is why this stays an anchor with an href.
 */
export function DocLink({ doc, className, children }: { doc: Document; className?: string; children: ReactNode }) {
  const open = useOpenDocument();
  return (
    <Link
      to={docHref(doc)}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        open(doc);
      }}
    >
      {children}
    </Link>
  );
}
