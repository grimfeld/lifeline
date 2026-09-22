import type { Document } from "@lifeline/core";
import { colorVar, type ColorSlot } from "@lifeline/ui";

export const APP_ID = "swearjar";
export const OFFENCE = "swearjar_offence";
export const FINE = "swearjar_fine";

export const SWEARJAR_HREF = "/app/swearjar";

/**
 * An Offence (ADR 0054): a named, priced thing the user fines themself for —
 * "Snoozed the alarm · €2". Never deleted while Fines reference it; archived
 * instead, out of the logging picker with its past months kept whole.
 */
export interface Offence extends Document {
  type: typeof OFFENCE;
  /** "Snoozed the alarm" — also the title. */
  name: string;
  /** What one Fine costs from now on, integer cents, above zero. */
  price: number;
  /** The face's emoji — one grapheme, "" for none (the name's first letter stands in). */
  emoji: string;
  /** The face's colour slot, "" for none (the App's colour stands in). */
  color: ColorSlot | "";
  archived: boolean;
}

/**
 * A Fine (ADR 0054, internal): one incident of an Offence. `amount` is the
 * Offence's price when it was logged — a fact, never re-valued by a later
 * repricing. `occurredAt` is when it really happened (backdating allowed).
 */
export interface Fine extends Document {
  type: typeof FINE;
  offenceId: string;
  /** Integer cents, the Offence's price at logging. */
  amount: number;
  /** ISO instant. */
  occurredAt: string;
  /** Optional — "in front of the kids". */
  note: string;
}

/** The Swear Jar's own colour — what a faceless Offence is painted with. */
export const SWEARJAR_COLOR = "var(--chart-red)";

/** What an Offence shows for a face: its emoji, else the first letter of its name. */
export function faceOf(o: Pick<Offence, "name" | "emoji">): string {
  if (o.emoji) return o.emoji;
  const first = Array.from(o.name.trim())[0];
  return first ? first.toLocaleUpperCase() : "·";
}

/** The CSS colour an Offence is painted with: its slot, else the App's colour. */
export function faceColor(o: Pick<Offence, "color">): string {
  return o.color ? colorVar(o.color) : SWEARJAR_COLOR;
}

/** One grapheme — the first of whatever was typed — or "". */
export function firstGrapheme(s: string): string {
  const t = s.trim();
  if (!t) return "";
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) {
    for (const g of new Seg(undefined, { granularity: "grapheme" }).segment(t)) return g.segment;
  }
  return Array.from(t)[0] ?? "";
}

/** A dozen faces one tap away in the editor — the usual culprits. */
export const EMOJI_PRESETS = ["🤬", "⏰", "📱", "🍔", "🚬", "🍺", "🛋️", "💸", "🍫", "🎮", "😤", "🥱"];
