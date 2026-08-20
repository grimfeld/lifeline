import { useLiveQuery } from "dexie-react-hooks";
import { db, VIEWS, type ViewFilter, type ViewLayout, type ViewRecord } from "../data/db";
import { put, remove } from "../data/repo";
import { newId } from "../ids";
import { normalizeName } from "../markdown";
import { appById } from "../registry";
import { patchDocument } from "./store";
import { displayTitle, type Document, type DocumentTypeDef, type FieldDef } from "./types";

/**
 * Bases (CONTEXT.md "Base" / "View"): one Base per type, holding saved
 * Views. A View is filters + search + sort + visible columns + layout; the
 * implicit "All" View is `{ filters: [] }`. This module is the pure query
 * side plus the View records' persistence.
 */

export const ALL_VIEW_ID = "all";

/** Pseudo-fields every Base can filter/sort on, besides the type's own. */
export const COMMON_COLUMNS: FieldDef[] = [
  { key: "title", label: "Title", kind: "text" },
  { key: "tags", label: "Tags", kind: "multiselect" },
  { key: "folder", label: "Folder", kind: "text" },
  { key: "createdAt", label: "Created", kind: "date" },
  { key: "updatedAt", label: "Updated", kind: "datetime" },
];

export function fieldByKey(def: DocumentTypeDef | undefined, key: string): FieldDef | undefined {
  return def?.fields.find((f) => f.key === key) ?? COMMON_COLUMNS.find((f) => f.key === key);
}

/** Default visible columns of a type: title, its first visible fields, tags. */
export function defaultColumns(def: DocumentTypeDef | undefined): string[] {
  const own = (def?.fields ?? []).filter((f) => !f.hidden);
  const flagged = own.filter((f) => f.column);
  const chosen = (flagged.length > 0 ? flagged : own.slice(0, 4)).map((f) => f.key);
  return ["title", ...chosen, "tags"];
}

function valueOf(doc: Document, key: string): unknown {
  return key === "title" ? doc.title : doc[key];
}

function asText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(String).join(" ");
  return String(v);
}

export function matchesFilter(doc: Document, f: ViewFilter): boolean {
  const v = valueOf(doc, f.field);
  const empty = v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
  switch (f.op) {
    case "empty":
      return empty;
    case "notEmpty":
      return !empty;
    case "eq":
      if (Array.isArray(v)) return v.map(String).includes(String(f.value));
      if (typeof v === "boolean") return v === (f.value === true || f.value === "true");
      return asText(v) === asText(f.value);
    case "neq":
      if (Array.isArray(v)) return !v.map(String).includes(String(f.value));
      return asText(v) !== asText(f.value);
    case "contains":
      return normalizeName(asText(v)).includes(normalizeName(asText(f.value)));
    case "gt":
      return typeof v === "number" ? v > Number(f.value) : asText(v) > asText(f.value);
    case "lt":
      return typeof v === "number" ? v < Number(f.value) : asText(v) < asText(f.value);
    case "anyOf": {
      const want = Array.isArray(f.value) ? f.value.map(String) : [asText(f.value)];
      if (want.length === 0) return true;
      const have = Array.isArray(v) ? v.map(String) : [asText(v)];
      return want.some((w) => have.includes(w));
    }
  }
}

export interface ViewQuery {
  filters?: ViewFilter[];
  search?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

/** Apply a View's filters, search and sort to the Base's Documents. Pure. */
export function applyView(docs: Document[], q: ViewQuery, def?: DocumentTypeDef): Document[] {
  let out = docs;
  const filters = q.filters ?? [];
  if (filters.length > 0) out = out.filter((d) => filters.every((f) => matchesFilter(d, f)));
  const s = q.search?.trim();
  if (s) {
    const k = normalizeName(s);
    out = out.filter((d) => normalizeName(displayTitle(d, def)).includes(k) || normalizeName(asText(d.body)).includes(k) || d.tags.some((t) => t.includes(k)));
  }
  const sortBy = q.sortBy ?? "updatedAt";
  const dir = q.sortDir ?? (sortBy === "updatedAt" || sortBy === "createdAt" ? "desc" : "asc");
  const sign = dir === "asc" ? 1 : -1;
  out = [...out].sort((a, b) => {
    const va = sortBy === "title" ? displayTitle(a, def) : valueOf(a, sortBy);
    const vb = sortBy === "title" ? displayTitle(b, def) : valueOf(b, sortBy);
    if (typeof va === "number" && typeof vb === "number") return (va - vb) * sign;
    const ta = asText(va);
    const tb = asText(vb);
    if (ta === tb) return 0;
    if (ta === "") return 1;
    if (tb === "") return -1;
    return ta.localeCompare(tb, undefined, { numeric: true, sensitivity: "base" }) * sign;
  });
  return out;
}

// --- layouts (ADR 0020) ----------------------------------------------------

/** The field picks a View stores for layouts that read one (ADR 0020). */
export interface LayoutFields {
  imageField?: string;
  geoField?: string;
  groupField?: string;
  dateField?: string;
}

const COVERISH = /cover|image|photo|poster|art|thumb|icon/i;

/** Fields a layout can read for one type; empty = the layout is not offered (gallery is always offered). */
export function layoutFieldCandidates(def: DocumentTypeDef | undefined, layout: ViewLayout): FieldDef[] {
  const own = (def?.fields ?? []).filter((f) => !f.hidden);
  switch (layout) {
    case "gallery":
      return own.filter((f) => f.kind === "url" || (f.kind === "text" && COVERISH.test(f.key + " " + f.label)));
    case "map":
      return own.filter((f) => f.kind === "geo");
    case "board":
      return own.filter((f) => f.kind === "select");
    case "calendar":
      return [...own.filter((f) => f.kind === "date" || f.kind === "datetime"), COMMON_COLUMNS.find((f) => f.key === "createdAt")!];
    default:
      return [];
  }
}

/** Layouts this type's Base offers: the three flat ones + gallery always; map/board/calendar only with a usable field. */
export function availableLayouts(def: DocumentTypeDef | undefined): ViewLayout[] {
  const out: ViewLayout[] = ["table", "list", "cards", "gallery"];
  if (layoutFieldCandidates(def, "map").length > 0) out.push("map");
  if (layoutFieldCandidates(def, "board").length > 0) out.push("board");
  out.push("calendar"); // createdAt is always there
  return out;
}

const PICK_KEY: Partial<Record<ViewLayout, keyof LayoutFields>> = { gallery: "imageField", map: "geoField", board: "groupField", calendar: "dateField" };

/** The stored pick key a layout uses, if it needs a field. */
export function layoutPickKey(layout: ViewLayout): keyof LayoutFields | undefined {
  return PICK_KEY[layout];
}

/** Resolve the field a layout reads: the stored pick if still valid, else the first candidate. */
export function layoutFieldOf(picks: LayoutFields, def: DocumentTypeDef | undefined, layout: ViewLayout): FieldDef | undefined {
  const candidates = layoutFieldCandidates(def, layout);
  const key = PICK_KEY[layout];
  const picked = key ? picks[key] : undefined;
  return candidates.find((f) => f.key === picked) ?? candidates[0];
}

export type FieldChangeResult = "written" | "declined" | "readonly";

/**
 * Change one field of one Document from a generic layout (a board drag).
 * Plain fields get the raw write; guarded fields become a request to the
 * owning App, which runs its real operation or declines (ADR 0020). No
 * hook → "readonly", nothing happens.
 */
export async function requestFieldChange(doc: Document, def: DocumentTypeDef | undefined, fieldKey: string, value: string): Promise<FieldChangeResult> {
  const field = def?.fields.find((f) => f.key === fieldKey);
  if (!field) return "readonly";
  if (!field.guarded) {
    await patchDocument(doc.id, { [fieldKey]: value });
    return "written";
  }
  const hook = def?.appId ? appById(def.appId)?.requestFieldChange : undefined;
  if (!hook) return "readonly";
  return (await hook(doc, fieldKey, value)) ? "written" : "declined";
}

// --- persistence -----------------------------------------------------------

export function useViews(type: string | undefined): ViewRecord[] {
  return useLiveQuery(
    async () => (type ? (await db().collection<ViewRecord>(VIEWS).where("type").equals(type).toArray()).filter((v) => !v.deleted).sort((a, b) => a.sort - b.sort) : []),
    [type],
    [] as ViewRecord[],
  );
}

export function useAllViews(): ViewRecord[] {
  return useLiveQuery(async () => (await db().collection<ViewRecord>(VIEWS).where("deleted").equals(0).toArray()).sort((a, b) => a.sort - b.sort), [], [] as ViewRecord[]);
}

export function useView(id: string | undefined): ViewRecord | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return undefined;
      const v = await db().collection<ViewRecord>(VIEWS).get(id);
      return v && !v.deleted ? v : undefined;
    },
    [id],
    undefined,
  );
}

export async function saveView(input: Omit<ViewRecord, "id" | "updatedAt" | "deleted"> & { id?: string }): Promise<ViewRecord> {
  const { id, ...rest } = input;
  const rec: ViewRecord = { ...rest, id: id ?? newId(), updatedAt: "", deleted: 0 };
  await put<ViewRecord>(VIEWS, rec);
  return rec;
}

export async function deleteView(id: string): Promise<void> {
  await remove(VIEWS, id);
}
