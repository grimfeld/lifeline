import { QUICK_MAKE_MAX, type Handoff } from "@lifeline/core";

/**
 * The name a Person is made with from a Handoff: the selected words when they
 * are a name (short, one line) — "Anne Dupont" selected in a Day — else the
 * Handoff's title (a web page's, from outside Lifeline).
 */
export function nameFromHandoff(handoff: Handoff): string {
  const text = handoff.text.trim();
  if (text && text.length <= QUICK_MAKE_MAX && !/[\r\n]/.test(text)) return text;
  return handoff.title.trim();
}
