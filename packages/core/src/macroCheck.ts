import { isInvocable, linkableDocuments, pickLinked, readCommandArgs, type LinkableDocument } from "./commands";
import { MACRO_APP, commandNavigates, stepKey, type MacroShape, type OwnedCommand } from "./macros";
import type { CommandArg } from "./manifest";

/**
 * The check a Macro passes before its first step (ADR 0092): every step can be
 * given what it needs, or the Macro is broken and says why. Pure over the
 * Macro, the Command registry and a Document lookup, so the shell and the MCP
 * server (an agent's Macro, checked as strictly) run the same rules.
 */

/**
 * Where a fixed link's Document is looked for: the Documents a link argument
 * may name (of its Role, else its type(s), else all), as the store holds them
 * — with their Roles. `storeLookup` reads the Workspace the caller is in.
 */
export interface DocumentLookup {
  linkable(arg: CommandArg): Promise<readonly LinkableDocument[]>;
}

/** The lookup over the local store, through its Workspace gates — the shell's, and the MCP device worker's. */
export const storeLookup: DocumentLookup = { linkable: linkableDocuments };

/** A Macro is fine, or broken, with each reason. */
export type MacroCheck = { ok: true } | { ok: false; reasons: string[] };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const empty = (v: unknown) => v === undefined || v === null || v === "";

/** Why a fixed value does not fit its argument; none when it does. A link is looked up, rows are checked row by row. */
async function valueProblems(arg: CommandArg, value: unknown, lookup: DocumentLookup): Promise<string[]> {
  if (empty(value)) return [];
  if (arg.kind === "link") {
    try {
      pickLinked(arg, String(value), await lookup.linkable(arg));
      return [];
    } catch (e) {
      return [message(e)];
    }
  }
  if (arg.kind === "rows") {
    let rows = value;
    if (typeof rows === "string") {
      try {
        rows = JSON.parse(rows);
      } catch {
        return [`${arg.label}: expected a list of rows`];
      }
    }
    if (!Array.isArray(rows)) return [`${arg.label}: expected a list of rows`];
    const out: string[] = [];
    for (const [i, row] of rows.entries()) {
      const at = `${arg.label}, row ${i + 1}: `;
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        out.push(`${at}expected a record`);
        continue;
      }
      const of = arg.of ?? [];
      const values = row as Record<string, unknown>;
      for (const key of Object.keys(values)) if (!of.some((a) => a.key === key)) out.push(`${at}takes no “${key}”`);
      for (const a of of) {
        if (a.required && empty(values[a.key])) out.push(`${at}${a.label} is required`);
        else out.push(...(await valueProblems(a, values[a.key], lookup)).map((p) => at + p));
      }
    }
    return out;
  }
  try {
    await readCommandArgs([{ ...arg, required: false }], { [arg.key]: value });
    return [];
  } catch (e) {
    return [message(e)];
  }
}

/**
 * Check a Macro before it runs: every Command exists and is not a Macro, a
 * step that goes somewhere is last, every value a step gives is one its
 * Command takes and fits it, fixed links name one living Document, a step's
 * result is taken only from an earlier step that makes a Document, and every
 * required value has a source.
 */
export async function checkMacro(macro: MacroShape, commands: readonly OwnedCommand[], lookup: DocumentLookup = storeLookup): Promise<MacroCheck> {
  if (macro.steps.length === 0) return { ok: false, reasons: ["It has no steps"] };
  const defs = macro.steps.map((s) => commands.find((c) => stepKey(c) === s.command));
  const reasons: string[] = [];
  for (const [i, step] of macro.steps.entries()) {
    const at = `Step ${i + 1}: `;
    const def = defs[i];
    if (!def) {
      reasons.push(`${at}“${step.command}” no longer exists`);
      continue;
    }
    if (def.appId === MACRO_APP) {
      reasons.push(`${at}“${def.title}” is a Macro, and a Macro cannot be a step`);
      continue;
    }
    if (commandNavigates(def) && i < macro.steps.length - 1) reasons.push(`${at}“${def.title}” goes somewhere, so it must be the last step`);
    const args = isInvocable(def) ? def.args : [];
    for (const [key, src] of Object.entries(step.args)) {
      const arg = args.find((a) => a.key === key);
      if (!arg) {
        reasons.push(`${at}“${def.title}” takes no “${key}”`);
        continue;
      }
      if (src.from === "fixed") reasons.push(...(await valueProblems(arg, src.value, lookup)).map((p) => at + p));
      if (src.from === "step") {
        const made = `${at}${arg.label} takes what step ${src.step + 1} made, but `;
        const earlier = src.step >= 0 && src.step < i ? defs[src.step] : undefined;
        if (!(src.step >= 0 && src.step < i)) reasons.push(`${made}step ${src.step + 1} does not come before it`);
        // Only a headless step reports what it made; a dialog or a place makes nothing a later step can take.
        else if (earlier && !isInvocable(earlier)) reasons.push(`${made}“${earlier.title}” makes no Document`);
      }
    }
    for (const arg of args) {
      const src = step.args[arg.key];
      if (arg.required && (!src || (src.from === "fixed" && empty(src.value))))
        reasons.push(`${at}${arg.label} is required, and is neither fixed, asked nor taken from a step`);
    }
  }
  return reasons.length ? { ok: false, reasons } : { ok: true };
}
