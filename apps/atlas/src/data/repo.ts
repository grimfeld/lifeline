import { useMemo } from "react";
import { PLACE_TYPE, allDocumentTypes, allDocuments, buildLinkIndex, createDocument, documentsOf, getDocument, locateAddress, normalizeTags, patchDocument, renameDocument, saveFieldOptions, todayStr, useDocuments, writeGeo, type Coords, type Document, type Located, type Lookup } from "@lifeline/core";
import { hasHappened, kindFrom, normalizePlace, placeTitled, visitedBy } from "../domain/place";
import { PLACES_FOLDER, type Place } from "../domain/types";

/**
 * A Place's title is another Place's (ADR 0119): the refusal names it, and
 * carries it so a form can offer it and an agent can use its id.
 */
export class PlaceTaken extends Error {
  constructor(
    title: string,
    readonly existing: Document,
  ) {
    super(`“${title}” is already a Place: ${existing.title}`);
    this.name = "PlaceTaken";
  }
}

/** Every Place in the Workspace, live, with the App's keys well-formed. */
export function usePlaces(): Place[] {
  const docs = useDocuments(PLACE_TYPE);
  return useMemo(() => docs.map(normalizePlace), [docs]);
}

/** A live row as a Place, or none when it is missing, deleted, or no Place. */
export const livePlace = (row: Document | undefined): Place | undefined => (row && !row.deleted && row.type === PLACE_TYPE ? normalizePlace(row) : undefined);

const cleanAliases = (aliases: readonly string[] | undefined) => (aliases ?? []).map((a) => a.trim()).filter(Boolean);

/** Throws `PlaceTaken` when another Place has this title, in any folder, case and accents aside. */
async function assertFree(title: string, self?: string): Promise<void> {
  const taken = placeTitled(await documentsOf(PLACE_TYPE), title, self);
  if (taken) throw new PlaceTaken(title, taken);
}

/** An address as the form gives it: the text, and the coordinates when a typeahead hit or a Locate candidate was picked. */
export interface AddressInput {
  text: string;
  at?: Coords;
}

/** Where a Place's address stands after a save: on the map, off it (nothing found, or the lookup failed), or none given. */
export type AddressSaved = Located["kind"] | "cleared";

/**
 * The address's stored keys, and where it stands: picked coordinates as they
 * are; typed text looked up once, here, on save (ADR 0011); none for no text.
 */
async function resolveAddress(input: AddressInput, lookup: Lookup): Promise<{ fields: { address: string; geo: [number, number] | null }; placed: AddressSaved }> {
  const text = input.text.trim();
  // A spot with no address (Just here, #501) keeps its coordinates; no text and no spot is off the map.
  if (!text) return input.at ? { fields: { address: "", geo: writeGeo(input.at) }, placed: "found" } : { fields: { address: "", geo: null }, placed: "cleared" };
  const located: Located = input.at ? { kind: "found", at: input.at } : await lookup(text);
  return { fields: { address: text, geo: writeGeo(located.kind === "found" ? located.at : null) }, placed: located.kind };
}

/**
 * Add a Place: a name is all it takes (#487 story 1). A Kind (by value or
 * name), aliases, Tags and an address are kept when given; a typed address is
 * looked up on save, a picked one keeps its coordinates. Lands in Places.
 * Throws when the name is empty, its Kind is none, or another Place has it
 * (`PlaceTaken`). An address found nowhere is kept, off the map.
 */
export async function addPlace(
  input: { name: string; kind?: string; aliases?: string[]; tags?: string[]; address?: string; at?: Coords; toTry?: boolean },
  lookup: Lookup = locateAddress,
): Promise<Place> {
  const name = input.name.trim();
  if (!name) throw new Error("A Place needs a name");
  const kind = kindFrom(input.kind);
  await assertFree(name);
  const { fields: address } = await resolveAddress({ text: input.address ?? "", at: input.at }, lookup);
  const doc = await createDocument({
    type: PLACE_TYPE,
    title: name,
    folder: PLACES_FOLDER,
    fields: { aliases: cleanAliases(input.aliases), kind, tags: normalizeTags(input.tags ?? []), ...address, toTry: input.toTry === true, closed: false },
  });
  return normalizePlace(doc);
}

/**
 * Change a Place's address (#487 story 15). The same text keeps the
 * coordinates it has, with nothing looked up; picked coordinates are taken as
 * they are; new typed text is looked up again, and leaves the map when found
 * nowhere rather than keep the old spot. No text clears both.
 */
export async function setPlaceAddress(id: string, input: AddressInput, lookup: Lookup = locateAddress): Promise<AddressSaved> {
  const doc = await getDocument(id);
  if (!doc) throw new Error("No such Place");
  const was = normalizePlace(doc);
  const text = input.text.trim();
  if (!input.at && text && text === was.address) return was.geo ? "found" : "none";
  const { fields, placed } = await resolveAddress(input, lookup);
  await patchDocument(id, fields);
  return placed;
}

export interface PlacePatch {
  title?: string;
  kind?: string;
  aliases?: string[];
  tags?: string[];
  toTry?: boolean;
  /** Closed for good, or reopened with false (ADR 0119). */
  closed?: boolean;
}

/**
 * Change a Place: only the patched keys. A new name renames it, rewriting
 * every `[[link]]` to the old one; one another Place has is refused (`PlaceTaken`).
 */
export async function patchPlace(id: string, patch: PlacePatch): Promise<void> {
  const { title, ...rest } = patch;
  const fields: Record<string, unknown> = {};
  if (rest.kind !== undefined) fields.kind = kindFrom(rest.kind);
  if (rest.aliases) fields.aliases = cleanAliases(rest.aliases);
  if (rest.tags) fields.tags = normalizeTags(rest.tags);
  if (rest.toTry !== undefined) fields.toTry = rest.toTry;
  if (rest.closed !== undefined) fields.closed = rest.closed;
  if (title !== undefined) {
    if (!title.trim()) throw new Error("A Place needs a name");
    const doc = await getDocument(id);
    if (doc) {
      await assertFree(title.trim(), id);
      await renameDocument(doc, title);
    }
  }
  if (Object.keys(fields).length) await patchDocument(id, fields);
}

/** Rename and add Kinds: the list as the user wants it, a new one with no value. None is ever lost. */
export const saveKindOptions = (options: readonly { value?: string; label: string }[]) => saveFieldOptions(PLACE_TYPE, "kind", options);

/**
 * Clear To try on the Places that have been gone to since it was set: an
 * Event that has happened links to each, by At or in its notes (ADR 0119).
 * Every To try Place, or the one given. Idempotent: a Place cleared, or never
 * marked, is not written again. Run when an Event is saved and when a Place is
 * opened, so a dinner that passed while nothing was saved still counts.
 */
export async function settleToTry(placeId?: string): Promise<void> {
  const marked = (await documentsOf(PLACE_TYPE)).filter((p) => p.toTry === true && (!placeId || p.id === placeId));
  if (marked.length === 0) return;
  const today = todayStr();
  // Built here, not through the UI's shared index, so a save never evicts the screen's.
  const index = buildLinkIndex(await allDocuments(), allDocumentTypes());
  for (const p of marked) if (visitedBy(index, p.id, today)) await patchDocument(p.id, { toTry: false });
}

/** After an Event is saved (Core's `afterSaveOf`, ADR 0121): only one that has happened can clear a To try. */
export async function afterEventSaved(event: Document): Promise<void> {
  if (hasHappened(event, todayStr())) await settleToTry();
}
