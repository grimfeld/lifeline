import { COMMON_COLUMNS, type DocumentTypeDef, type FieldDef, type ViewFilter, type ViewFilterOp } from "@lifeline/core";

/** A Base's filter conditions, as the filter bar offers them. */
export const OPS: { value: ViewFilterOp; label: string; needsValue: boolean }[] = [
  { value: "eq", label: "is", needsValue: true },
  { value: "neq", label: "is not", needsValue: true },
  { value: "contains", label: "contains", needsValue: true },
  { value: "anyOf", label: "any of", needsValue: true },
  { value: "gt", label: ">", needsValue: true },
  { value: "lt", label: "<", needsValue: true },
  { value: "empty", label: "is empty", needsValue: false },
  { value: "notEmpty", label: "is set", needsValue: false },
];

/** The fields a Base filters on: the common ones but Updated, and the type's own visible, non-JSON fields. */
export function filterableFields(def: DocumentTypeDef | undefined): FieldDef[] {
  return [...COMMON_COLUMNS.filter((c) => c.key !== "updatedAt"), ...(def?.fields ?? []).filter((f) => !f.hidden && f.kind !== "json")];
}

/** A filter chip's words: "Status is Read", "Notes is empty". */
export function describeFilter(f: ViewFilter, def: DocumentTypeDef | undefined): string {
  const field = filterableFields(def).find((x) => x.key === f.field);
  const op = OPS.find((o) => o.value === f.op);
  const v = Array.isArray(f.value) ? f.value.join(", ") : f.value === undefined ? "" : String(f.value);
  const opt = field?.options?.find((o) => o.value === v);
  return `${field?.label ?? f.field} ${op?.label ?? f.op}${op?.needsValue ? ` ${opt?.label ?? v}` : ""}`;
}

/**
 * The filter a draft adds, its value read the way its field stores it — a
 * list for "any of", a number, a yes/no — or null while a value it needs is
 * missing. `picked` is a value chosen just now (a date), not yet in the draft.
 */
export function draftFilter(draft: ViewFilter, field: FieldDef | undefined, picked?: ViewFilter["value"]): ViewFilter | null {
  const op = OPS.find((o) => o.value === draft.op)!;
  let value = picked ?? draft.value;
  if (op.needsValue && (value === "" || value === undefined)) return null;
  if (draft.op === "anyOf" && typeof value === "string") value = value.split(",").map((s) => s.trim()).filter(Boolean);
  if (field?.kind === "number" && typeof value === "string") value = Number(value);
  if (field?.kind === "boolean") value = value === "true" || value === true;
  return { ...draft, value };
}
