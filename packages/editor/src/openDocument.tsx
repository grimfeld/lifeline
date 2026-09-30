import { useCallback, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { docHref, openDocument, type Document } from "@lifeline/core";

/**
 * Opens a Document the way a link should (ADR 0057): inside its Home Module
 * it goes there, from anywhere else it **peeks** — the owner's small view over
 * where the user is.
 */
export function useOpenDocument(): (doc: Document) => void {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback((doc: Document) => openDocument(doc, { pathname, navigate }), [pathname, navigate]);
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
