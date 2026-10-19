/**
 * The pending Handoff (ADR 0080): what this tab was handed, kept in session
 * storage from arrival until it is used or abandoned, so that a sign-in on
 * the Handoff page, or the reload an Account switch makes, does not lose it.
 * Kept as the codec-encoded fragment it arrived as.
 */
const KEY = "lifeline.handoff.pending";

/** The Handoff this tab holds: the one in the address when there is one, else the one kept from before. */
export function arrivingHandoff(hash: string): string {
  if (hash.replace(/^#/, "")) return hash;
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function keepPendingHandoff(fragment: string): void {
  try {
    sessionStorage.setItem(KEY, fragment);
  } catch {
    // No session storage: the Handoff lives as long as the page does.
  }
}

/** Used or abandoned: the next visit to the Handoff page starts empty. */
export function dropPendingHandoff(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing was kept.
  }
}
