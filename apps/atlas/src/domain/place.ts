import { PLACE_TYPE, documentType, foldName, normalizeName, readGeo, type Document, type FieldOption } from "@lifeline/core";
import { KINDS, type Place } from "./types";

/** The Kind options as they stand: the App's, under the user's names, then the user's own. */
export const kindOptionsOf = (): FieldOption[] => documentType(PLACE_TYPE)?.fields.find((f) => f.key === "kind")?.options ?? KINDS.map((k) => ({ ...k }));

/** A Kind's name, or the stored value when no option has it any more. */
export const kindLabel = (value: string, options: readonly FieldOption[] = kindOptionsOf()): string => options.find((o) => o.value === value)?.label ?? value;

/** What the completer and the Peek say a Place is: "Place", or "Place · Restaurant". */
export function placeSubtitle(doc: Document): string {
  const kind = typeof doc.kind === "string" ? doc.kind : "";
  return kind ? `Place · ${kindLabel(kind)}` : "Place";
}

/**
 * The Kind a typed word names, by value or name, case and accents aside; ""
 * for none given. Throws in words, naming the Kinds there are, when it names none.
 */
export function kindFrom(input: string | undefined, options: readonly FieldOption[] = kindOptionsOf()): string {
  const wanted = foldName((input ?? "").trim());
  if (!wanted) return "";
  const hit = options.find((o) => foldName(o.value) === wanted || foldName(o.label) === wanted);
  if (!hit) throw new Error(`No Kind “${input!.trim()}”: one of ${options.map((o) => o.label).join(", ")}`);
  return hit.value;
}

/** The Place whose title this one would clash with (Places' titles are unique, ADR 0119), but `self`. */
export function placeTitled(places: readonly Document[], title: string, self?: string): Document | undefined {
  const t = normalizeName(title);
  return places.find((p) => p.id !== self && !p.deleted && normalizeName(p.title) === t);
}

/**
 * Where a Place stands on the map: its stored coordinates, or none. The
 * type's Locatable reader, so a map reads what was found on save and never
 * looks anything up itself (ADR 0011).
 */
export function placeCoordsOf(doc: Document): { lat: number; lon: number } | null {
  return readGeo(doc.geo);
}

/** A Place as stored, with the App's keys filled in for a row a Base or an older build wrote. */
export function normalizePlace(doc: Document): Place {
  const at = placeCoordsOf(doc);
  return {
    ...doc,
    aliases: Array.isArray(doc.aliases) ? doc.aliases.map(String) : [],
    kind: typeof doc.kind === "string" ? doc.kind : "",
    address: typeof doc.address === "string" ? doc.address : "",
    geo: at ? [at.lat, at.lon] : null,
  } as Place;
}

/** The Places screen's list: of one Kind when one is picked, A to Z by name. */
export function placesList(places: readonly Place[], filter: { kind?: string } = {}): Place[] {
  return places.filter((p) => !filter.kind || p.kind === filter.kind).sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}
