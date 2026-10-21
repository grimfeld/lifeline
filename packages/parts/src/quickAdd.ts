import { initialText } from "@lifeline/core";

/** One medium as a family App's QuickAdd speaks of it — a slice of the App's work-type registry. */
export interface QuickAddMedium<M extends string = string> {
  id: M;
  label: string;
  /** Its To… Shelf ("To watch"), where an add lands. */
  wantLabel: string;
  creatorLabel: string;
}

/** The medium a QuickAdd opens on: the one asked for, else the last one added to in this App, else the App's first. */
export function startingMedium<M extends string>(media: readonly QuickAddMedium<M>[], asked: M | undefined, remembered: string | null): M {
  if (asked) return asked;
  return media.find((m) => m.id === remembered)?.id ?? media[0].id;
}

/** "Add a movie — director…": what to type, and that a creator may follow the title. */
export function quickAddPlaceholder(medium: Pick<QuickAddMedium, "label" | "creatorLabel">, creator = medium.creatorLabel.toLowerCase()): string {
  return `Add ${/^[aeiou]/i.test(medium.label) ? "an" : "a"} ${medium.label.toLowerCase()} — ${creator}…`;
}

/**
 * What a palette inline line (CommandDialogProps.initial) puts in a QuickAdd:
 * the text it reads ("Title — Creator"), and the medium when the line named
 * one this App has.
 */
export function quickAddFromLine<M extends string>(
  initial: Record<string, unknown> | undefined,
  media: readonly QuickAddMedium<M>[],
  creatorKey = "creator",
): { text: string; medium: M | undefined } {
  const title = initialText(initial, "title").trim();
  const creator = initialText(initial, creatorKey).trim();
  const named = initialText(initial, "type");
  return { text: creator ? `${title} — ${creator}` : title, medium: media.find((m) => m.id === named)?.id };
}
