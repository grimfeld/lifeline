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

/**
 * The one Person a name or alias points to (case and accents aside), else a
 * readable refusal: nobody has it, or several do (and who they are, so the
 * caller can say which). Used by the agents' `people_occasion_add`.
 */
export function findPerson<P extends { title: string; aliases?: string[] }>(people: readonly P[], name: string): { person: P } | { problem: string } {
  const want = fold(name);
  if (!want) return { problem: "Say which Person (a name or an alias)" };
  const hits = people.filter((p) => [p.title, ...(p.aliases ?? [])].some((n) => fold(n) === want));
  if (hits.length === 1) return { person: hits[0]! };
  if (hits.length === 0) return { problem: `No Person called “${name.trim()}”` };
  return { problem: `“${name.trim()}” is ambiguous: ${hits.map((p) => p.title).join(", ")}. Use a name that is only one of them` };
}
