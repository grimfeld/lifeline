import { allDocuments, documentsOf, getDocument } from "./documents/store";
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

/** Whether a Command can be run headless. */
export function isInvocable(def: CommandDef): def is CommandDef & { args: CommandArg[]; invoke: NonNullable<CommandDef["invoke"]> } {
  return !!def.invoke && !!def.args;
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

/**
 * A link argument names a Document by id or by its exact title,
 * case-insensitive, among `docs` (already read through the store's gates, so
 * the call's Workspace only). Never a guess: no match, or several, is an
 * error the caller can act on.
 */
export function pickLinked(arg: CommandArg, value: string, docs: readonly Pick<Document, "id" | "type" | "title">[]): string {
  const types = linkTypes(arg);
  const ofType = types ? docs.filter((d) => types.includes(d.type)) : docs;
  const byId = ofType.find((d) => d.id === value);
  if (byId) return byId.id;
  const wanted = value.trim().toLowerCase();
  const hits = ofType.filter((d) => d.title.trim().toLowerCase() === wanted);
  const what = arg.label.toLowerCase();
  if (hits.length === 1) return hits[0].id;
  if (hits.length === 0) throw new Error(`${arg.label}: no ${what} called “${value}”`);
  throw new Error(`${arg.label}: ${hits.length} ${what}s are called “${value}”; pass one id: ${hits.map((d) => d.id).join(", ")}`);
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

/** Run a Command headless: arguments checked against its signature, then the App's `invoke`. */
export async function invokeCommand(def: CommandDef, raw: Record<string, unknown>): Promise<CommandResult> {
  if (!isInvocable(def)) throw new Error(`“${def.title}” cannot be run without its dialog`);
  return def.invoke(await readCommandArgs(def.args, raw));
}
