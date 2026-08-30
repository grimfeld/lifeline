/**
 * The eight named colour slots every App may paint with — `--chart-<slot>`
 * in globals.css, defined for light and dark. A Document that carries a
 * colour stores the slot name, never a CSS value, so themes stay in charge.
 */
export const COLOR_SLOTS = ["blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red"] as const;
export type ColorSlot = (typeof COLOR_SLOTS)[number];

export function colorVar(slot: string): string {
  return `var(--chart-${slot})`;
}

export function isColorSlot(v: unknown): v is ColorSlot {
  return typeof v === "string" && (COLOR_SLOTS as readonly string[]).includes(v);
}
