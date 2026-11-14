import { dotJoin } from "./dots";
import { QUICK_MAKE_MAX, initialText, type Handoff } from "@lifeline/core";

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

/** The line under a Person's name: "65 years old · also Mum, Maman", leaving out what is not known. */
export function knownLine(aliases: readonly string[], age: number | null): string {
  return dotJoin([age === null ? "" : `${age} years old`, aliases.length ? `also ${aliases.join(", ")}` : ""]);
}

/** The name an Add person dialog opens with: from a Handoff when it has one, else from the caller's initial values. */
export const initialName = (handoff: Handoff | undefined, initial: Record<string, unknown> | undefined) => (handoff ? nameFromHandoff(handoff) : initialText(initial, "name"));

/** A name as compared: case and accents aside. */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
