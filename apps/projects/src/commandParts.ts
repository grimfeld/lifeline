import type { CommandArg } from "@lifeline/core";

/** Argument parts the Projects Commands share. */

/** An optional 0-based place in an ordered list. */
export const positionArg = (what: string): CommandArg => ({ key: "position", label: "Position", kind: "number", hint: `0-based place in the ${what} order; 0 is first. Omit to leave it (when adding: last).` });

/** The place asked for, refused unless a whole number from 0. */
export function readPosition(a: Record<string, unknown>): number | undefined {
  const n = a.position as number | undefined;
  if (n !== undefined && (!Number.isInteger(n) || n < 0)) throw new Error("Position: expected a whole number from 0");
  return n;
}

/** Core drops empty arguments, so a field is emptied by naming it here. */
export const clearArg = (fields: string[]): CommandArg => ({
  key: "clear",
  label: "Clear",
  kind: "multiselect",
  options: fields.map((f) => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1) })),
  hint: "Fields to empty. A field cannot be both given and cleared.",
});

/** The fields to clear; one that is also given is refused. */
export function readClear(a: Record<string, unknown>): Set<string> {
  const clear = new Set((a.clear as string[] | undefined) ?? []);
  for (const f of clear) if (a[f] !== undefined) throw new Error(`Clear: ${f} is both given and cleared`);
  return clear;
}
