import type { FieldDef, FieldKind } from "./types";

/**
 * Known fields (CONTEXT.md "Known field", ADR 0078): the Fields whose key and
 * kind Lifeline recognises and acts on — Aliases and Coordinates. Pure.
 */

export type KnownFieldId = "aliases" | "coordinates";

/** A Known field as the "+ Field" menu offers it: what it adds, and one line on what it does. */
export interface KnownField {
  id: KnownFieldId;
  label: string;
  key: string;
  kind: FieldKind;
  note: string;
}

export const KNOWN_FIELDS: readonly KnownField[] = [
  { id: "aliases", label: "Aliases", key: "aliases", kind: "list", note: "Other names [[links]] find its Documents by" },
  { id: "coordinates", label: "Coordinates", key: "coordinates", kind: "geo", note: "Puts its Documents on the map, and a map layout in its Base" },
];

export const knownField = (id: KnownFieldId): KnownField => KNOWN_FIELDS.find((k) => k.id === id)!;

type FieldLike = Pick<FieldDef, "key" | "kind"> & { label?: string };

/** The type a Field sits on, as far as Known fields care. */
export interface KnownFieldType {
  builtIn: boolean;
  linkable: boolean;
  /** A user type's map Field (`locatableField`), when it names one of its geo Fields. */
  locatableField?: string;
}

/** Which of a user type's geo Fields is its Coordinates: the one it maps by, else the first (ADR 0078). */
function coordinatesKey(fields: FieldLike[], type: KnownFieldType): string | undefined {
  if (type.builtIn) return undefined;
  const geo = fields.filter((f) => f.kind === "geo");
  return (geo.find((f) => f.key === type.locatableField) ?? geo[0])?.key;
}

/** What one Field is: a Known field, or ordinary — and a one-line note when either needs saying. */
export interface FieldReading {
  known?: KnownFieldId;
  note?: string;
}

/** Each Field of a type read for Known fields, in order. */
export function knownFieldReadings(fields: FieldLike[], type: KnownFieldType): FieldReading[] {
  const coords = coordinatesKey(fields, type);
  const map = fields.find((f) => f.kind === "geo" && f.key === coords);
  return fields.map((f): FieldReading => {
    if (f.key === "aliases" && f.kind === "list") return { known: "aliases", note: type.linkable ? knownField("aliases").note : "Does nothing until the type is Linkable" };
    if (f === map) return { known: "coordinates", note: knownField("coordinates").note };
    if (f.key === "aliases") return { note: "Links won't use it — Aliases is a List" };
    if (f.kind === "geo" && map) return { note: `Not on the map — “${map.label || map.key}” is the type's Coordinates` };
    return {};
  });
}

/** A Known field the "+ Field" menu offers; `makesLinkable` when picking it turns the type's Linkable on. */
export type KnownFieldChoice = KnownField & { makesLinkable?: boolean };

/**
 * The Known fields a type may still add, Aliases first: Aliases on a Linkable
 * type — or a user type, which picking it makes Linkable — without an
 * `aliases` key; Coordinates on a user type without a geo Field (at most one).
 * Pass a built-in's own Fields too.
 */
export function knownFieldsToAdd(fields: FieldLike[], type: KnownFieldType): KnownFieldChoice[] {
  const out: KnownFieldChoice[] = [];
  if ((type.linkable || !type.builtIn) && !fields.some((f) => f.key === "aliases")) {
    const a = knownField("aliases");
    out.push(type.linkable ? a : { ...a, note: `${a.note} — turns Linkable on`, makesLinkable: true });
  }
  if (!type.builtIn && !fields.some((f) => f.kind === "geo")) out.push(knownField("coordinates"));
  return out;
}
