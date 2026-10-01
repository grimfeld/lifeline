import { getDocument } from "./documents/store";
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
      const id = String(v);
      const doc = await getDocument(id);
      const types = arg.linkType === undefined ? undefined : Array.isArray(arg.linkType) ? arg.linkType : [arg.linkType];
      if (!doc || (types && !types.includes(doc.type))) throw new Error(`${arg.label}: no ${types?.join(" or ") ?? "document"} with id ${id}`);
      return id;
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
