import { addDays, fromParts, parts, startOfWeek, type DateStr, type Document, type FieldDef } from "@lifeline/core";

/**
 * Where the layouts that place Documents (ADR 0020) put each one, and which
 * they cannot place: those are omitted but counted, never swallowed.
 */

/** A Document's place on a map from a geo field: [lat, lon], or null when it has none to give. */
export function geoOf(d: Document, field: FieldDef | undefined): [number, number] | null {
  const v = field ? d[field.key] : undefined;
  const [lat, lon] = Array.isArray(v) ? (v as [number, number]) : [NaN, NaN];
  return typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
}

/**
 * A board's columns over a select field: one per option, in its order, then
 * "—" for the Documents whose value is none of them (only when there are any).
 */
export function boardColumns(docs: Document[], field: FieldDef): { columns: { value: string; label: string }[]; byValue: Map<string, Document[]> } {
  const options = field.options ?? [];
  const known = new Set(options.map((o) => o.value));
  const byValue = new Map<string, Document[]>();
  for (const d of docs) {
    const v = String(d[field.key] ?? "");
    const key = known.has(v) ? v : "";
    byValue.set(key, [...(byValue.get(key) ?? []), d]);
  }
  const columns = [...options.map((o) => ({ value: o.value, label: o.label })), ...(byValue.has("") ? [{ value: "", label: "—" }] : [])];
  return { columns, byValue };
}

/** A calendar's Documents by the day in a date or datetime field; those with no day are omitted. */
export function byDayOf(docs: Document[], field: FieldDef | undefined): { byDay: Map<string, Document[]>; omitted: Document[]; placed: number } {
  const byDay = new Map<string, Document[]>();
  const omitted: Document[] = [];
  let placed = 0;
  for (const d of docs) {
    const day = String((field ? d[field.key] : "") ?? "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      byDay.set(day, [...(byDay.get(day) ?? []), d]);
      placed++;
    } else omitted.push(d);
  }
  return { byDay, omitted, placed };
}

/** A month's grid, Monday first: five weeks, or six when the month reaches into the sixth. */
export function monthGrid(y: number, m: number): DateStr[] {
  const gridStart = startOfWeek(fromParts(y, m, 1));
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
    // Drop the 6th row when it lies wholly in the next month.
    .filter((_, i) => i < 35 || parts(addDays(gridStart, 35)).m === m);
}
