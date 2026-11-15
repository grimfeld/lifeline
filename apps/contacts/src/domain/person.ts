import { dotJoin } from "./dots";
import { PERSON_TYPE, QUICK_MAKE_MAX, aliasesOf, documentType, initialText, type Handoff } from "@lifeline/core";
import type { Person } from "./types";

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

/** Every name a Person answers to beside their title: aliases and Given name, as links read them (ADR 0117). */
export const otherNamesOf = (p: PersonNames): string[] => aliasesOf(p, documentType(PERSON_TYPE));

/** What naming a Person reads of them: their title, and the aliases and Given name when they have them. */
export type PersonNames = Pick<Person, "title"> & Partial<Pick<Person, "aliases" | "givenName">>;


/**
 * The title a Person is added with when none is typed (ADR 0117): the Given and
 * Family names, "Anne Dupont". Only at add: after that neither rewrites the other.
 */
export const composeTitle = (given: string | undefined, family: string | undefined) => [given, family].map((n) => (n ?? "").trim()).filter(Boolean).join(" ");

/** An alias is a name, kept as written: not lower-cased and hyphenated as a Tag is. A TagInput's `normalize`. */
export const asName = (raw: string) => raw.trim() || null;

/** Aliases as stored: each trimmed, blanks dropped. A Person's and a Household's alike. */
export const cleanAliases = (aliases: readonly string[] | undefined) => (aliases ?? []).map((a) => a.trim()).filter(Boolean);
