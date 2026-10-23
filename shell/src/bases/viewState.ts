import { defaultColumns, type DocumentTypeDef, type ViewFilter, type ViewLayout, type ViewRecord } from "@lifeline/core";

/** A Base's working View: what is on screen, saved or not. */
export interface ViewState {
  filters: ViewFilter[];
  search: string;
  sortBy: string;
  sortDir: "asc" | "desc";
  columns: string[];
  layout: ViewLayout;
  /** Field picks for layouts that read one (ADR 0020). */
  imageField?: string;
  geoField?: string;
  groupField?: string;
  dateField?: string;
}

/** A saved View as the working state; no View is "All": last updated first, the type's default columns, a table. */
export function stateOf(v: ViewRecord | undefined, def: DocumentTypeDef | undefined): ViewState {
  return {
    filters: v?.filters ?? [],
    search: v?.search ?? "",
    sortBy: v?.sortBy ?? "updatedAt",
    sortDir: v?.sortDir ?? "desc",
    columns: v?.columns ?? defaultColumns(def),
    layout: v?.layout ?? "table",
    imageField: v?.imageField,
    geoField: v?.geoField,
    groupField: v?.groupField,
    dateField: v?.dateField,
  };
}

/** A column header clicked: the sorted column turns round, another sorts ascending. */
export function sortedBy(s: ViewState, key: string): ViewState {
  return s.sortBy === key ? { ...s, sortDir: s.sortDir === "asc" ? "desc" : "asc" } : { ...s, sortBy: key, sortDir: "asc" };
}

/** A column shown or hidden: a new one goes last. */
export function withColumnToggled(s: ViewState, key: string): ViewState {
  return { ...s, columns: s.columns.includes(key) ? s.columns.filter((c) => c !== key) : [...s.columns, key] };
}
