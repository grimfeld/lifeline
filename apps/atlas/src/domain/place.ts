import { PLACE_TYPE, documentFigures, documentType, eventLastDay, sourceOf, foldName, readGeo, type Coords, type DateStr, type Document, type FieldOption, type LinkIndex } from "@lifeline/core";
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

/** How the Places screen orders its list (#487 story 58): A to Z by name, or by last visit, newest first. */
export type PlacesSort = "name" | "lastVisit";

const byName = (a: Place, b: Place) => a.title.localeCompare(b.title, undefined, { sensitivity: "base" });

/**
 * The Places screen's list: the open Places, those To try or the closed ones,
 * of one Kind when one is picked; A to Z by name, or by last visit (newest
 * first, the Places never visited last, a tie A to Z), read through `lastVisit`.
 */
export function placesList(
  places: readonly Place[],
  filter: { kind?: string; show?: PlacesShown; sort?: PlacesSort; lastVisit?: (id: string) => DateStr | undefined } = {},
): Place[] {
  const shown = places.filter((p) => shownIn(p, filter.show ?? "open") && (!filter.kind || p.kind === filter.kind));
  if (filter.sort !== "lastVisit" || !filter.lastVisit) return shown.sort(byName);
  const last = new Map(shown.map((p) => [p.id, filter.lastVisit!(p.id) ?? ""]));
  return shown.sort((a, b) => last.get(b.id)!.localeCompare(last.get(a.id)!) || byName(a, b));
}

/** A Place's last visit: the Visited figure (ADR 0119), the last day an Event that links here was on, up to today; none if never. */
export const lastVisitOf = (index: LinkIndex, placeId: string, today: DateStr): DateStr | undefined => documentFigures(index, placeId, today, sourceOf("seen", today)).last ?? undefined;

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

/**
 * The To try day a Place's write keeps (ADR 0119), whoever writes it (Core's
 * `beforeSave`, ADR 0123): marked anew, today; still marked, the day it has
 * (none for an older build's mark); unmarked, none.
 */
export function toTryOnSave(next: Document, was: Document | undefined, today: DateStr): { toTrySince: string } | undefined {
  if (next.toTry !== true) return next.toTrySince ? { toTrySince: "" } : undefined;
  if (was?.toTry === true) return { toTrySince: typeof was.toTrySince === "string" ? was.toTrySince : "" };
  return { toTrySince: today };
}
