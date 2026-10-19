/**
 * Where the Lifeline extension sends: the deployed Lifeline, the Handoff
 * page's address there, and the done address it closes its window at.
 * Pure — the browser glue in background.ts calls these.
 */
import { addressOn, HANDOFF_DONE_PATH, type Handoff } from "@lifeline/handoff";

/**
 * The deployed Lifeline (Vercel project `lifeline-shell`). Not written anywhere
 * else in the repo, and not a setting (ADR 0080): a self-hosted Lifeline builds
 * its own copy of the extension with this changed.
 */
export const DEFAULT_LIFELINE_URL = "https://lifeline.grimfeld.tech";

/** The size of the Handoff page's window: a dialog over the page, not a new browser window. */
export const HANDOFF_WINDOW = { width: 480, height: 640 } as const;

/** The host-permission pattern for a Lifeline, so the extension may see its window reach the done address. */
export function lifelineHostPattern(base: string): string {
  return `${new URL(base).origin}/*`;
}

/** Whether a tab's address is the Handoff page's done address on the Lifeline at `base`. */
export function isDoneUrl(url: string | undefined, base: string): boolean {
  if (!url) return false;
  const done = addressOn(base, HANDOFF_DONE_PATH);
  if (!url.startsWith(done)) return false;
  const rest = url.slice(done.length);
  return rest === "" || /^[/?#]/.test(rest);
}

/** The Handoff of a page the extension may not script (a browser page, a store): its tab's title and URL, no text. */
export function tabHandoff(tab: { title?: string; url?: string }): Handoff {
  const handoff: Handoff = { title: tab.title?.trim() ?? "", text: "" };
  if (tab.url) handoff.url = tab.url;
  return handoff;
}
