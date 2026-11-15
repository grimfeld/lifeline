import type { MacroReason } from "@lifeline/core";

/** Where a refusal is kept and shown: under one argument of one step (zero-based). */
export const refusalKey = (step: number, key: string): string => `${step}:${key}`;

/**
 * The refusals of a save, each under its step's argument. Every problem of one
 * argument is shown (two bad names in one list), so its texts are joined; the
 * texts carry no step, which the field's own place already says.
 */
export function refusalsOf(reasons: readonly MacroReason[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of reasons) {
    const at = refusalKey(r.step ?? -1, r.key ?? "");
    out[at] = at in out ? `${out[at]}; ${r.text}` : r.text;
  }
  return out;
}

/** The refusals without those of one step: what it said no longer holds once the step changes. */
export function withoutStep(refused: Record<string, string>, step: number): Record<string, string> {
  return Object.fromEntries(Object.entries(refused).filter(([k]) => !k.startsWith(`${step}:`)));
}
