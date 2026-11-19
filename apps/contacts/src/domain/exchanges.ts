import { addDays, inPrivateFolder, inScope, isDateStr, type DateStr, type Document } from "@lifeline/core";

/**
 * The Exchange (CONTEXT.md, ADR 0131): a call, video call, message or letter
 * with one or more People, on a day — never a time, never a day to come — with
 * an optional body for what was said. Its title is derived from its kind and
 * the names of its People, and stored, so Bases sort on it; the App writes it
 * again whenever either changes (`data/exchanges.ts`).
 */
export type ExchangeKind = "call" | "video" | "message" | "letter";

/** The kinds, in the order the Form offers them; Call first, and the default. */
export const EXCHANGE_KINDS: readonly { value: ExchangeKind; label: string }[] = [
  { value: "call", label: "Call" },
  { value: "video", label: "Video call" },
  { value: "message", label: "Message" },
  { value: "letter", label: "Letter" },
];

/** A stored kind as one of the four: anything else (a Base's typo) reads as a call. */
export const exchangeKindOf = (v: unknown): ExchangeKind => (EXCHANGE_KINDS.some((k) => k.value === v) ? (v as ExchangeKind) : "call");

export const labelOf = (kind: unknown) => EXCHANGE_KINDS.find((k) => k.value === exchangeKindOf(kind))!.label;

/** "Call · Grandma", "Message · Marc, Léa"; "Call · nobody" once its People are all gone. */
export function exchangeTitle(kind: unknown, names: readonly string[]): string {
  return `${labelOf(kind)} · ${names.length ? names.join(", ") : "nobody"}`;
}

/**
 * The title as stored, from its People as they stand: only those of its own
 * Workspace (ADR 0048), and none named from the Private folder (ADR 0038):
 * the title is read where they are hidden (a locked device, an agent), so
 * they count as "someone", or "2 people", after the names.
 */
export function exchangeTitleOf(kind: unknown, people: readonly Pick<Document, "title" | "folder" | "workspace">[], workspace: string): string {
  const here = people.filter((p) => inScope(p, workspace));
  const hidden = here.filter((p) => inPrivateFolder(p.folder)).length;
  const names = here.filter((p) => !inPrivateFolder(p.folder)).map((p) => p.title);
  return exchangeTitle(kind, hidden ? [...names, hidden === 1 ? "someone" : `${hidden} people`] : names);
}

/** The refusal of a day to come: the dialog's and the agent's alike. */
export const FUTURE_EXCHANGE = "An exchange is something that happened. Plan a call as a Task or an Event.";

/** A real YYYY-MM-DD: one that survives a round trip through the calendar (no 30 February). */
const realDay = (d: unknown): d is DateStr => isDateStr(d) && addDays(d, 0) === d;

/** What is wrong with an Exchange as it would be saved, in words; nothing when it may be. */
export function exchangeProblem(x: { with: readonly string[]; date: string }, today: DateStr): string | undefined {
  if (!realDay(x.date)) return "Pick the day it happened.";
  if (x.date > today) return FUTURE_EXCHANGE;
  if (x.with.length === 0) return "An exchange is with at least one Person.";
  return undefined;
}
