import { useMemo } from "react";
import { PLACE_TYPE, createDocument, documentsOf, getDocument, normalizeTags, patchDocument, renameDocument, saveFieldOptions, useDocuments, type Document, type FieldOption } from "@lifeline/core";
import { kindFrom, kindOptionsOf, normalizePlace, placeTitled } from "../domain/place";
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

/**
 * Add a Place: a name is all it takes (#487 story 1). A Kind (by value or
 * name), aliases and Tags are kept when given. Lands in Places. Throws when
 * the name is empty, its Kind is none, or another Place has it (`PlaceTaken`).
 */
export async function addPlace(input: { name: string; kind?: string; aliases?: string[]; tags?: string[] }): Promise<Place> {
  const name = input.name.trim();
  if (!name) throw new Error("A Place needs a name");
  const kind = kindFrom(input.kind);
  await assertFree(name);
  const doc = await createDocument({ type: PLACE_TYPE, title: name, folder: PLACES_FOLDER, fields: { aliases: cleanAliases(input.aliases), kind, tags: normalizeTags(input.tags ?? []) } });
  return normalizePlace(doc);
}

export interface PlacePatch {
  title?: string;
  kind?: string;
  aliases?: string[];
  tags?: string[];
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

/** The Kind options as they stand (ADR 0119). */
export const kindOptions = (): FieldOption[] => kindOptionsOf();

/** Rename and add Kinds: the list as the user wants it, a new one with no value. None is ever lost. */
export const saveKindOptions = (options: readonly { value?: string; label: string }[]) => saveFieldOptions(PLACE_TYPE, "kind", options);
