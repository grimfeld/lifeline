import { useEffect } from "react";

const APP = "Lifeline";

interface Claim {
  title: string;
  fallback: boolean;
}

// Every mounted claim, oldest first. A page's own title beats the place's
// fallback whichever effect ran last: a parent's effect runs after its child's,
// so "last writer wins" would let the shell's fallback hide the PageHeader.
const claims: Claim[] = [];

function newest(fallback: boolean): Claim | undefined {
  for (let i = claims.length - 1; i >= 0; i--) {
    const claim = claims[i];
    if (claim?.fallback === fallback) return claim;
  }
  return undefined;
}

function apply() {
  const claim = newest(false) ?? newest(true);
  document.title = claim ? `${claim.title} · ${APP}` : APP;
}

/**
 * Sets the tab's title to "<title> · Lifeline" while the caller is mounted
 * (WCAG 2.4.2). `PageHeader` calls it with its title; the shell calls it with
 * `fallback` for the place the user stands in, which shows when the page has
 * no title of its own. An empty title claims nothing.
 */
export function useDocumentTitle(title: string | undefined, { fallback = false }: { fallback?: boolean } = {}) {
  useEffect(() => {
    const text = title?.trim();
    if (!text) return;
    const claim = { title: text, fallback };
    claims.push(claim);
    apply();
    return () => {
      claims.splice(claims.indexOf(claim), 1);
      apply();
    };
  }, [title, fallback]);
}
