import { kindLabel } from "./typeRules";
import type { FieldKind } from "./types";

/**
 * What the Type editor's "+ Field" menu offers (spec #95, #102): the plain
 * kinds, each with one line on what it unlocks — a Base layout it feeds
 * (views.ts `layoutFieldCandidates`), backlinks and Graph edges for a Link.
 * Pure data, so the facts are tested against the rules they describe.
 */
export interface FieldKindChoice {
  kind: FieldKind;
  label: string;
  /** One line: what the kind holds and what it unlocks. */
  note: string;
}

const NOTES: [FieldKind, string][] = [
  ["text", "One line of text"],
  ["longtext", "Several lines of text"],
  ["number", "A number"],
  ["boolean", "A tick box"],
  ["date", "A day — adds a calendar layout to its Base, not the Calendar app"],
  ["datetime", "A day and a time — adds a calendar layout to its Base, not the Calendar app"],
  ["select", "One of a list of options — adds a board layout to its Base"],
  ["multiselect", "Any of a list of options"],
  ["url", "A web address — can be its Base's gallery image"],
  ["geo", "A place — adds a map layout to its Base"],
  ["list", "Several short values"],
  ["link", "One Document — a backlink on it and an edge in the Graph"],
  ["links", "Several Documents — backlinks on them and edges in the Graph"],
];

/** The plain kinds, in the Kind dropdown's order. */
export const ADD_FIELD_KINDS: readonly FieldKindChoice[] = NOTES.map(([kind, note]) => ({ kind, label: kindLabel(kind), note }));
