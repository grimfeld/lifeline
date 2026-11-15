import { PLACE_TYPE, documentType, eventLastDay, foldName, normalizeName, readGeo, type Coords, type DateStr, type Document, type FieldOption, type LinkIndex } from "@lifeline/core";
import { KINDS, type Place } from "./types";

/** The Kind options as they stand: the App's, under the user's names, then the user's own. */
export const kindOptions = (): FieldOption[] => documentType(PLACE_TYPE)?.fields.find((f) => f.key === "kind")?.options ?? KINDS.map((k) => ({ ...k }));

/** A Kind's name, or the stored value when no option has it any more. */
export const kindLabel = (value: string, options: readonly FieldOption[] = kindOptions()): string => options.find((o) => o.value === value)?.label ?? value;

/** What the completer and the Peek say a Place is: "Place", or "Place · Restaurant". */
export function placeSubtitle(doc: Document): string {
  const kind = typeof doc.kind === "string" ? doc.kind : "";
  return kind ? `Place · ${kindLabel(kind)}` : "Place";
}

/**
 * The Kind a typed word names, by value or name, case and accents aside; ""
 * for none given. Throws in words, naming the Kinds there are, when it names none.
 */
export function kindFrom(input: string | undefined, options: readonly FieldOption[] = kindOptions()): string {
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
 * Where a Place stands on the map: its stored coordinates, or none while it
 * has none or is closed (ADR 0119: a closed Place has no Pin). The type's
 * Locatable reader, so a map reads what was found on save and never looks
 * anything up itself (ADR 0011).
 */
export function placeCoordsOf(doc: Document): Coords | null {
  return doc.closed === true ? null : readGeo(doc.geo);
}

/** A Place as stored, with the App's keys filled in for a row a Base or an older build wrote. */
export function normalizePlace(doc: Document): Place {
  const at = readGeo(doc.geo);
  return {
    ...doc,
    aliases: Array.isArray(doc.aliases) ? doc.aliases.map(String) : [],
    kind: typeof doc.kind === "string" ? doc.kind : "",
    address: typeof doc.address === "string" ? doc.address : "",
    geo: at ? [at.lat, at.lon] : null,
    toTry: doc.toTry === true,
    closed: doc.closed === true,
  } as Place;
}

/** Which Places a list shows: the open ones (the default), those To try, or the closed ones. */
export type PlacesShown = "open" | "toTry" | "closed";

/** Whether a Place belongs in a list: a closed one is in the closed list only (ADR 0119). */
const shownIn = (p: Place, show: PlacesShown) => (show === "closed" ? p.closed : !p.closed && (show === "open" || p.toTry));

/** The Places screen's list: the open Places, those To try or the closed ones, of one Kind when one is picked, A to Z by name. */
export function placesList(places: readonly Place[], filter: { kind?: string; show?: PlacesShown } = {}): Place[] {
  return places
    .filter((p) => shownIn(p, filter.show ?? "open") && (!filter.kind || p.kind === filter.kind))
    .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" }));
}

/** Whether an Event has happened: its last day is before today (ADR 0119). Today's is still to come. */
export const hasHappened = (doc: Document | undefined, today: DateStr): boolean => {
  const last = eventLastDay(doc);
  return !!last && last < today;
};

/**
 * Whether a Place has been gone to: an Event that has happened links to it,
 * by its At or a wikilink in its notes (ADR 0119). What clears To try. A Day
 * that names it is a mention, never a visit. With `since` (the day To try was
 * marked), only an Event whose last day is on or after it counts, so a Place
 * gone to before can be marked again; without, any that has happened does.
 */
export const visitedBy = (index: LinkIndex, placeId: string, today: DateStr, since?: DateStr): boolean =>
  index.backlinksTo(placeId).some((b) => {
    const event = index.byId.get(b.sourceId);
    return hasHappened(event, today) && (!since || eventLastDay(event)! >= since);
  });

/** The day a Place was marked To try, when it was marked by a build that keeps it; none for an older mark. */
export const toTrySinceOf = (doc: Document): DateStr | undefined => (typeof doc.toTrySince === "string" && /^\d{4}-\d{2}-\d{2}$/.test(doc.toTrySince) ? doc.toTrySince : undefined);
