import type { Document, FieldDef, FieldKind } from "./types";

/**
 * The rules for changing a user-defined type that already holds Documents
 * (CONTEXT.md "Field", "Document type"; ADR 0072). Pure: the caller hands in
 * every Document of the type, in every Workspace.
 */

const isEmpty = (v: unknown): boolean => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Whether a stored value is a valid value of a Field of this kind. Empty fits every kind. */
export function fitsKind(v: unknown, f: Pick<FieldDef, "kind" | "options">): boolean {
  if (isEmpty(v)) return true;
  const allowed = f.options ? new Set(f.options.map((o) => o.value)) : undefined;
  switch (f.kind) {
    case "text":
      return typeof v === "string" && !v.includes("\n");
    case "longtext":
    case "url":
    case "link":
      return typeof v === "string";
    case "number":
      return typeof v === "number" && Number.isFinite(v);
    case "boolean":
      return typeof v === "boolean";
    case "date":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
    case "datetime":
      return typeof v === "string" && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(v);
    case "select":
      return typeof v === "string" && (!allowed || allowed.has(v));
    case "multiselect":
      return isStrings(v) && (!allowed || v.every((x) => allowed.has(x)));
    case "list":
    case "links":
      return isStrings(v);
    case "geo":
      return Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === "number" && Number.isFinite(x));
    default:
      return false;
  }
}

const KIND_LABEL: Record<string, string> = {
  text: "Text",
  longtext: "Long text",
  number: "Number",
  boolean: "Yes / no",
  date: "Date",
  datetime: "Date & time",
  select: "Choice",
  multiselect: "Multi-choice",
  url: "URL",
  geo: "Coordinates",
  list: "List",
  link: "Link to Document",
  links: "Links to Documents",
};
export const kindLabel = (k: FieldKind): string => KIND_LABEL[k] ?? k;

/**
 * Why a type's new Fields cannot be saved over its old ones: a Field is fixed
 * once it exists — relabelled freely, its kind (and a choice's options)
 * changed only where every value it already holds still fits. Empty when the
 * change is fine. Removing a Field is never a problem (its values are kept).
 */
export function fieldChangeProblems(before: readonly FieldDef[], after: readonly FieldDef[], docs: readonly Document[]): string[] {
  const old = new Map(before.map((f) => [f.key, f]));
  const problems: string[] = [];
  for (const f of after) {
    const was = old.get(f.key);
    if (!was) continue;
    const misfits = docs.filter((d) => !fitsKind((d as Record<string, unknown>)[f.key], f)).length;
    if (misfits === 0) continue;
    const n = `${misfits} Document${misfits === 1 ? "" : "s"}`;
    problems.push(
      was.kind !== f.kind
        ? `“${f.label}” can't become ${kindLabel(f.kind)}: ${n} hold a value that isn't one — add a new field instead`
        : `“${f.label}”: ${n} use a choice that's no longer offered`,
    );
  }
  return problems;
}

/** The Fields a change removes, each with how many Documents hold a value for it (they keep it). */
export function removedFieldValues(before: readonly FieldDef[], after: readonly FieldDef[], docs: readonly Document[]): { field: FieldDef; count: number }[] {
  const kept = new Set(after.map((f) => f.key));
  return before
    .filter((f) => !kept.has(f.key))
    .map((field) => ({ field, count: docs.filter((d) => !isEmpty((d as Record<string, unknown>)[field.key])).length }));
}

/** How many Documents of a type there are, here and in every other Workspace. */
export interface TypeDocumentCount {
  here: number;
  elsewhere: number;
  total: number;
}

/** Why a user-defined type cannot be deleted (ADR 0072), or undefined when it can. */
export function typeDeleteRefusal(label: string, count: TypeDocumentCount): string | undefined {
  if (count.total === 0) return undefined;
  const where = count.elsewhere === 0 ? "" : count.here === 0 ? `, all in other Workspaces` : ` (${count.elsewhere} in other Workspaces)`;
  return `${label} still has ${count.total} Document${count.total === 1 ? "" : "s"}${where}. Empty it first — a Document never loses its type.`;
}
