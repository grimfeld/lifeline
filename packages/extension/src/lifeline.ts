/**
 * Where the Lifeline extension sends: the person's Lifeline (its options), the
 * Handoff page's address there, and the done address it closes its window at.
 * Pure — the browser glue in background.ts and options.ts calls these.
 */
import { HANDOFF_DONE_PATH, type Handoff } from "@lifeline/handoff";

/**
 * The deployed Lifeline (Vercel project `lifeline-shell`). Not written anywhere
 * else in the repo; a self-hosted Lifeline is set in the extension's options.
 */
export const DEFAULT_LIFELINE_URL = "https://lifeline.grimfeld.tech";

/** The storage.sync key of the Lifeline URL the person set. */
export const LIFELINE_URL_KEY = "lifelineUrl";

/** The size of the Handoff page's window: a dialog over the page, not a new browser window. */
export const HANDOFF_WINDOW = { width: 480, height: 640 } as const;

/**
 * What the person typed as their Lifeline, as the base address the Handoff page
 * hangs off (origin plus any path, no trailing slash); null when it is not an
 * http(s) address. A bare host is read as https.
 */
export function lifelineUrl(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return url.origin + url.pathname.replace(/\/+$/, "");
}

/** The host-permission pattern for a Lifeline, so the extension may see its window reach the done address. */
export function lifelineHostPattern(base: string): string {
  return `${new URL(base).origin}/*`;
}

/** Whether a tab's address is the Handoff page's done address on the Lifeline at `base`. */
export function isDoneUrl(url: string | undefined, base: string): boolean {
  if (!url) return false;
  const done = base.replace(/\/+$/, "") + HANDOFF_DONE_PATH;
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
