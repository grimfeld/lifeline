import { commandKey, commandNavigates, isInvocable, linkableDocuments, linkSource, linkProblemText, linkValues, matchLinks, pickLinked, readCommandArgs, takesDocument, type LinkableDocument, type OwnedCommand } from "./commands";
import { MACRO_APP, type MacroShape } from "./macros";
import type { CommandArg } from "./manifest";
import type { Document } from "./documents/types";

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

/** `storeLookup` for a caller that sees only some Documents (`InvokeContext.sees`, an agent's, ADR 0114). */
export function seeingLookup(sees: (doc: Document) => boolean): DocumentLookup {
  return { linkable: async (arg) => (await linkableDocuments(arg)).filter(sees) };
}

/**
 * One reason a Macro is broken. `fixed-link` is a fixed link, or entry of a
 * fixed list of links, that names no Document or several: the one kind the
 * Macro editor refuses to save. `step` and `key` (the argument) say where, when
 * the reason is about one argument of one step; `text` is the sentence, without
 * its step ("Source: No Source called “Gone”"): `reasonLine` puts it in a list.
 */
export interface MacroReason {
  kind: "fixed-link" | "other";
  /** Zero-based index of the step. */
  step?: number;
  /** The argument's key within that step. */
  key?: string;
  text: string;
}

/** A reason as a line of a list of reasons: its step's number (one-based) first, when it has a step. */
export const reasonLine = (r: MacroReason): string => (r.step === undefined ? r.text : `Step ${r.step + 1}: ${r.text}`);

/** A Macro is fine, or broken, with each reason. */
export type MacroCheck = { ok: true } | { ok: false; reasons: MacroReason[] };

/** A lookup that reads each candidate set once, however many links ask for it: one per check pass. */
export function memoLookup(lookup: DocumentLookup = storeLookup): DocumentLookup {
  const seen = new Map<string, Promise<readonly LinkableDocument[]>>();
  return {
    linkable(arg) {
      const key = JSON.stringify(linkSource(arg));
      let read = seen.get(key);
      if (!read) seen.set(key, (read = lookup.linkable(arg)));
      return read;
    },
  };
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
const empty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** Why a fixed value does not fit its argument; none when it does. A link is looked up, each entry of a list of links too, rows are checked row by row. */
async function valueProblems(arg: CommandArg, value: unknown, lookup: DocumentLookup): Promise<string[]> {
  if (empty(value)) return [];
  if (arg.kind === "links") {
    try {
      const values = linkValues(arg, value);
      return values.length ? matchLinks(arg, values, await lookup.linkable(arg)).problems.map(linkProblemText) : [];
    } catch (e) {
      return [message(e)];
    }
  }
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

/** Whether a step's result can be taken by a later step: a headless Command that says it returns a Document. */
export function returnsDocument(def: OwnedCommand): boolean {
  return isInvocable(def) && def.returnsDocument === true;
}

/**
 * Check a Macro before it runs: every Command exists and is not a Macro, a
 * step that goes somewhere is last, every value a step gives is one its
 * Command takes and fits it, fixed links name one living Document, a step's
 * result is taken only by a link or a list of links (as its one entry), from
 * an earlier step that returns a Document, and every required value has a source.
 */
export async function checkMacro(macro: MacroShape, commands: readonly OwnedCommand[], lookup: DocumentLookup = storeLookup): Promise<MacroCheck> {
  if (macro.steps.length === 0) return { ok: false, reasons: [{ kind: "other", text: "It has no steps" }] };
  const defs = macro.steps.map((s) => commands.find((c) => commandKey(c) === s.command));
  const reasons: MacroReason[] = [];
  const other = (text: string, step?: number, key?: string) => reasons.push({ kind: "other", step, key, text });
  for (const [i, step] of macro.steps.entries()) {
    const def = defs[i];
    if (!def) {
      other(`“${step.command}” no longer exists`, i);
      continue;
    }
    if (def.appId === MACRO_APP) {
      other(`“${def.title}” is a Macro, and a Macro cannot be a step`, i);
      continue;
    }
    if (def.readOnly) {
      other(`“${def.title}” only answers an agent, so it cannot be a step`, i);
      continue;
    }
    if (commandNavigates(def) && i < macro.steps.length - 1) other(`“${def.title}” goes somewhere, so it must be the last step`, i);
    const args = isInvocable(def) ? def.args : [];
    for (const [key, src] of Object.entries(step.args)) {
      const arg = args.find((a) => a.key === key);
      if (!arg) {
        other(`“${def.title}” takes no “${key}”`, i, key);
        continue;
      }
      if (src.from === "fixed") {
        const kind = takesDocument(arg) ? ("fixed-link" as const) : ("other" as const);
        for (const p of await valueProblems(arg, src.value, lookup)) reasons.push({ kind, step: i, key, text: p });
      }
      if (src.from === "step") {
        const made = `${arg.label} takes what step ${src.step + 1} made, but `;
        const earlier = src.step >= 0 && src.step < i ? defs[src.step] : undefined;
        if (!takesDocument(arg)) other(`${made}only a link or a list of links can take a Document`, i, key);
        else if (!(src.step >= 0 && src.step < i)) other(`${made}step ${src.step + 1} does not come before it`, i, key);
        // Only a headless step that says it returns a Document reports one; a dialog or a place makes nothing a later step can take.
        else if (earlier && !returnsDocument(earlier)) other(`${made}“${earlier.title}” makes no Document`, i, key);
      }
    }
    for (const arg of args) {
      const src = step.args[arg.key];
      if (arg.required && (!src || (src.from === "fixed" && empty(src.value))))
        other(`${arg.label} is required, and is neither fixed, asked nor taken from a step`, i, arg.key);
    }
  }
  return reasons.length ? { ok: false, reasons } : { ok: true };
}

/**
 * What the Macro editor refuses to save: the fixed-link reasons of the one
 * check (`checkMacro`), each with its step and argument. A draft broken any
 * other way is saved, and shows as broken.
 */
export function fixedLinkReasons(check: MacroCheck): MacroReason[] {
  return check.ok ? [] : check.reasons.filter((r) => r.kind === "fixed-link");
}
