import { allDocuments, documentsOf, getDocument } from "./documents/store";
import { documentsWithRole, hasRole } from "./documents/roles";
import type { Document } from "./documents/types";
import type { CommandArg, CommandDef, CommandResult } from "./manifest";

/**
 * Headless Commands (ADR 0062): a Command that declares an argument
 * signature and an `invoke` can be run without its dialog. Core checks the
 * arguments against the signature first, so an App's `invoke` receives values
 * of the declared shapes and only judges what is its own business.
 */

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** A Command as the registry lists it: with the App that owns it. */
export type OwnedCommand = CommandDef & { appId: string };

/** The `appId/commandId` key a Command is stored by — a capture pin, a Macro's step, a Key binding. */
export function commandKey(c: Pick<OwnedCommand, "appId" | "id">): string {
  return `${c.appId}/${c.id}`;
}

/** Whether a Command can be run headless. */
export function isInvocable(def: CommandDef): def is CommandDef & { args: CommandArg[]; invoke: NonNullable<CommandDef["invoke"]> } {
  return !!def.invoke && !!def.args;
}

/**
 * How a Command runs when it is picked — the one reading the palette, a
 * Macro's step and a key all share: headless with its arguments (`invoke`), in
 * its dialog, or by its `run`, which either takes the user somewhere or stays
 * (`navigates: false`). "none" when it has none of them (inline only).
 */
export type CommandRun = "headless" | "dialog" | "navigates" | "run" | "none";

export function commandRun(def: CommandDef): CommandRun {
  if (isInvocable(def)) return "headless";
  if (def.dialog) return "dialog";
  if (def.run) return (def.navigates ?? true) ? "navigates" : "run";
  return "none";
}

/**
 * Whether running a Command takes the user somewhere: as it says, or — when
 * it doesn't say — when all it has is `run` (no dialog, no headless form),
 * which is how a "Go to…" Command is written. A Macro's navigating step comes last.
 */
export function commandNavigates(def: CommandDef): boolean {
  return def.navigates ?? commandRun(def) === "navigates";
}

function isRealDate(s: string): boolean {
  if (!DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function asStrings(arg: CommandArg, v: unknown): string[] {
  const list = typeof v === "string" ? v.split(",") : v;
  if (!Array.isArray(list) || list.some((x) => typeof x !== "string")) throw new Error(`${arg.label}: expected a list of text`);
  return list.map((x: string) => x.trim()).filter(Boolean);
}

function linkTypes(arg: CommandArg): string[] | undefined {
  return arg.linkType === undefined ? undefined : Array.isArray(arg.linkType) ? arg.linkType : [arg.linkType];
}

/** What a link argument is matched against: a Document's id, type, title and Roles. */
export type LinkableDocument = Pick<Document, "id" | "type" | "title"> & { roles?: unknown };

/** The Documents a link argument may name: those of its Role, else of its type(s), else all. */
export function linkCandidates<T extends LinkableDocument>(arg: CommandArg, docs: readonly T[]): T[] {
  const types = linkTypes(arg);
  return arg.linkRole ? docs.filter((d) => hasRole(d, arg.linkRole!)) : types ? docs.filter((d) => types.includes(d.type)) : [...docs];
}

/**
 * A link argument names a Document by id or by its exact title,
 * case-insensitive, among `docs` (already read through the store's gates, so
 * the call's Workspace only). Never a guess: no match, or several, is an
 * error the caller can act on.
 */
export function pickLinked(arg: CommandArg, value: string, docs: readonly LinkableDocument[]): string {
  const ofType = linkCandidates(arg, docs);
  const byId = ofType.find((d) => d.id === value);
  if (byId) return byId.id;
  const wanted = value.trim().toLowerCase();
  const hits = ofType.filter((d) => d.title.trim().toLowerCase() === wanted);
  const what = arg.label.toLowerCase();
  if (hits.length === 1) return hits[0].id;
  if (hits.length === 0) throw new Error(`${arg.label}: no ${what} called “${value}”`);
  throw new Error(`${arg.label}: ${hits.length} ${what}s are called “${value}”; pass one id: ${hits.map((d) => d.id).join(", ")}`);
}

/** The Documents a link argument may name, read from the store (the current Workspace): of its Role, else its type(s), else all. */
export async function linkableDocuments(arg: CommandArg): Promise<Document[]> {
  const types = linkTypes(arg);
  if (arg.linkRole) return documentsWithRole(arg.linkRole);
  return types ? (await Promise.all(types.map((t) => documentsOf(t)))).flat() : allDocuments();
}

/** One argument, coerced to its kind; undefined when absent. Throws a readable message on a bad value. */
async function readArg(arg: CommandArg, v: unknown): Promise<unknown> {
  if (v === undefined || v === null || v === "") return undefined;
  switch (arg.kind) {
    case "text":
    case "longtext": {
      if (typeof v !== "string" && typeof v !== "number") throw new Error(`${arg.label}: expected text`);
      return String(v).trim() || undefined;
    }
    case "number": {
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n)) throw new Error(`${arg.label}: expected a number`);
      return n;
    }
    case "boolean": {
      if (typeof v === "boolean") return v;
      if (v === "true" || v === "false") return v === "true";
      throw new Error(`${arg.label}: expected true or false`);
    }
    case "date": {
      if (typeof v !== "string" || !isRealDate(v)) throw new Error(`${arg.label}: expected a date as YYYY-MM-DD`);
      return v;
    }
    case "time": {
      if (typeof v !== "string" || !TIME.test(v)) throw new Error(`${arg.label}: expected a time as HH:MM (24-hour)`);
      return v;
    }
    case "select": {
      const s = String(v);
      if (arg.options && !arg.options.some((o) => o.value === s)) {
        throw new Error(`${arg.label}: expected one of ${arg.options.map((o) => o.value).join(", ")}`);
      }
      return s;
    }
    case "multiselect": {
      const list = asStrings(arg, v);
      const bad = arg.options ? list.filter((s) => !arg.options!.some((o) => o.value === s)) : [];
      if (bad.length) throw new Error(`${arg.label}: ${bad.join(", ")} not among ${arg.options!.map((o) => o.value).join(", ")}`);
      return list;
    }
    case "list":
      return asStrings(arg, v);
    case "link": {
      const value = String(v);
      const types = linkTypes(arg);
      const doc = await getDocument(value);
      if (arg.linkRole) {
        if (doc && hasRole(doc, arg.linkRole)) return value;
        return pickLinked(arg, value, await documentsWithRole(arg.linkRole));
      }
      if (doc && (!types || types.includes(doc.type))) return value;
      const candidates = types ? (await Promise.all(types.map((t) => documentsOf(t)))).flat() : await allDocuments();
      return pickLinked(arg, value, candidates);
    }
    case "json": {
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          throw new Error(`${arg.label}: expected JSON`);
        }
      }
      if (typeof v !== "object") throw new Error(`${arg.label}: expected a structured value`);
      return v;
    }
    case "rows": {
      let list = v;
      if (typeof list === "string") {
        try {
          list = JSON.parse(list);
        } catch {
          throw new Error(`${arg.label}: expected a list of rows`);
        }
      }
      if (!Array.isArray(list)) throw new Error(`${arg.label}: expected a list of rows`);
      const rows: Record<string, unknown>[] = [];
      for (const [i, row] of list.entries()) {
        if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`${arg.label}, row ${i + 1}: expected a record`);
        rows.push(await readCommandArgs(arg.of ?? [], row as Record<string, unknown>).catch((e: Error) => Promise.reject(new Error(`${arg.label}, row ${i + 1}: ${e.message}`))));
      }
      return rows.length ? rows : undefined;
    }
  }
}

/**
 * The moment a headless record happened, from optional `date` and `time`
 * arguments: undefined when neither is given (the App's own "now"), the day
 * at `time` (noon by default) otherwise. A time alone is refused, and so is a
 * moment still to come: a record says what happened.
 */
export function momentOf(date: string | undefined, time: string | undefined, now: Date = new Date()): string | undefined {
  if (time !== undefined && date === undefined) throw new Error("A time needs a day");
  if (date === undefined) return undefined;
  const at = new Date(`${date}T${time ?? "12:00"}`);
  if (at > now) throw new Error("That moment is still to come; only what happened can be logged");
  return at.toISOString();
}

/** Check `raw` against the signature: unknown keys and missing required arguments are refused. */
export async function readCommandArgs(args: CommandArg[], raw: Record<string, unknown>): Promise<Record<string, unknown>> {
  const known = new Set(args.map((a) => a.key));
  const unknown = Object.keys(raw).filter((k) => !known.has(k));
  if (unknown.length) throw new Error(`Unknown argument${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`);
  const out: Record<string, unknown> = {};
  for (const arg of args) {
    const v = await readArg(arg, raw[arg.key]);
    if (v === undefined) {
      if (arg.required) throw new Error(`${arg.label} is required`);
      continue;
    }
    out[arg.key] = v;
  }
  return out;
}

/** What is wrong with each value, by its argument's key — empty when every one fits — so a form shows each under its own field. */
export async function argProblems(args: CommandArg[], raw: Record<string, unknown>): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const arg of args) {
    try {
      await readCommandArgs([arg], raw[arg.key] === undefined ? {} : { [arg.key]: raw[arg.key] });
    } catch (e) {
      out[arg.key] = e instanceof Error ? e.message : String(e);
    }
  }
  return out;
}

/** Run a Command headless: arguments checked against its signature, then the App's `invoke`. */
export async function invokeCommand(def: CommandDef, raw: Record<string, unknown>): Promise<CommandResult> {
  if (!isInvocable(def)) throw new Error(`“${def.title}” cannot be run without its dialog`);
  return def.invoke(await readCommandArgs(def.args, raw));
}

// ── A dialog's initial values (CommandDialogProps.initial) ────────────────
// The inline line hands a dialog the raw values it understood; these read them
// into what a dialog's fields hold. Absent or wrongly shaped reads as empty.

/** Initial text for a field ("" when there is none). */
export function initialText(initial: Record<string, unknown> | undefined, key: string): string {
  const v = initial?.[key];
  return typeof v === "string" ? v : "";
}

/** Initial number for a field; undefined when absent or not a number. */
export function initialNumber(initial: Record<string, unknown> | undefined, key: string): number | undefined {
  const v = initial?.[key];
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
}

/** Initial values for a list field: an array as is, a single text as one entry. */
export function initialList(initial: Record<string, unknown> | undefined, key: string): string[] {
  const v = initial?.[key];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return typeof v === "string" && v !== "" ? [v] : [];
}

/**
 * Initial moment for a date-and-time field, as `YYYY-MM-DDTHH:MM`: the day
 * given, the time given or noon (as the headless Commands default it).
 * undefined when no day is given.
 */
export function initialMoment(initial: Record<string, unknown> | undefined, dateKey = "date", timeKey = "time"): string | undefined {
  const date = initialText(initial, dateKey);
  if (!date) return undefined;
  return `${date}T${initialText(initial, timeKey) || "12:00"}`;
}
