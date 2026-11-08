import { useMemo } from "react";
import { PERSON_TYPE, createDocument, documentsOf, getDocument, newId, normalizeTags, patchDocument, renameDocument, useDocuments } from "@lifeline/core";
import { type Address, type ContactDetail, type Occasion, type Person } from "../domain/types";
import { normalizeAddresses } from "../domain/addresses";
import { contactDetailsOf } from "../domain/contactDetails";
import { putBack, takeOut } from "../domain/parts";
import { normalizeOccasions, occasionProblem } from "../domain/occasions";
import { findPerson } from "../domain/person";

/** A Person as stored, with the App's keys filled in for a row written before they existed. */
export function normalizePerson(doc: Person): Person {
  return { ...doc, aliases: Array.isArray(doc.aliases) ? doc.aliases : [], relationship: typeof doc.relationship === "string" ? doc.relationship : "", excludedFromDrifting: doc.excludedFromDrifting === true, occasions: normalizeOccasions(doc.occasions), addresses: normalizeAddresses(doc.addresses) };
}

/** Every Person in the Workspace, live, with the App's keys well-formed whatever a Base wrote. */
export function usePeople(): Person[] {
  const docs = useDocuments<Person>(PERSON_TYPE);
  return useMemo(() => docs.map(normalizePerson), [docs]);
}

/** Every Person in the Workspace, read once, normalised like `usePeople`. */
export const allPeople = async () => (await documentsOf<Person>(PERSON_TYPE)).map(normalizePerson);

export type OccasionInput = Pick<Occasion, "label" | "day" | "yearly">;

/** The input trimmed; throws in words when it is no Occasion (an empty label, no real day, a once one with no year). */
function validOccasion(input: OccasionInput): OccasionInput {
  const o = { label: input.label.trim(), day: input.day.trim(), yearly: input.yearly };
  const problem = occasionProblem(o);
  if (problem) throw new Error(problem);
  return o;
}

/** Add an Occasion to a Person; throws in words when it is not one (an empty label, no real day, a once one with no year). */
export async function addOccasion(personId: string, input: OccasionInput): Promise<Occasion> {
  const o = validOccasion(input);
  const occasion = { id: newId(), ...o };
  await updateParts(personId, "occasions", (list) => [...list, occasion]);
  return occasion;
}

/**
 * Add an Occasion to the Person a name or alias points to. Throws in words for
 * an unknown or ambiguous name, or for an Occasion that is none.
 */
export async function addOccasionByName(name: string, input: OccasionInput): Promise<{ person: Person; occasion: Occasion }> {
  const found = findPerson(await allPeople(), name);
  if ("problem" in found) throw new Error(found.problem);
  return { person: found.person, occasion: await addOccasion(found.person.id, input) };
}

/** Change an Occasion on a Person. */
export async function editOccasion(personId: string, id: string, input: OccasionInput): Promise<void> {
  const o = validOccasion(input);
  await updateParts(personId, "occasions", (list) => {
    if (!list.some((x) => x.id === id)) throw new Error("No such occasion");
    return list.map((x) => (x.id === id ? { id, ...o } : x));
  });
}

/** A part taken off a Person, and where it stood: what its Undo puts back. */
export interface Removed<T> {
  entry: T;
  index: number;
}

/** A Person's parts by key, each read from the stored row the way the App reads it. */
const PARTS = { occasions: normalizeOccasions, addresses: normalizeAddresses, contactDetails: (raw: unknown) => contactDetailsOf({ contactDetails: raw }) } as const;
type PartKey = keyof typeof PARTS;
type PartOf<K extends PartKey> = ReturnType<(typeof PARTS)[K]>[number];

async function partsOf<K extends PartKey>(personId: string, key: K): Promise<PartOf<K>[]> {
  const doc = await getDocument(personId);
  if (!doc || doc.type !== PERSON_TYPE) throw new Error("No such Person");
  return PARTS[key](doc[key]) as PartOf<K>[];
}

/** Change one of a Person's lists of parts: `change` is given the stored list, so two quick edits never overwrite each other. */
async function updateParts<K extends PartKey>(personId: string, key: K, change: (list: PartOf<K>[]) => PartOf<K>[]): Promise<void> {
  await patchDocument(personId, { [key]: change(await partsOf(personId, key)) });
}

/** Take one part off a Person (an Occasion, an Address, a Contact detail), handing back what Undo needs. */
export async function removePart<K extends PartKey>(personId: string, key: K, id: string): Promise<Removed<PartOf<K>>> {
  const all = await partsOf(personId, key);
  const { list, index } = takeOut(all, id);
  if (index < 0) throw new Error("It is already gone");
  await patchDocument(personId, { [key]: list });
  return { entry: all[index]!, index };
}

/** Undo `removePart`: that one part back where it stood, onto the list as it is now. */
export async function restorePart<K extends PartKey>(personId: string, key: K, removed: Removed<PartOf<K>>): Promise<void> {
  await updateParts(personId, key, (list) => putBack(list, removed.entry, removed.index));
}

const cleanAliases = (aliases: readonly string[] | undefined) => (aliases ?? []).map((a) => a.trim()).filter(Boolean);

/**
 * Add a Person: a name is all it takes (#404 story 1). Aliases, a
 * Relationship and Tags are kept when given. Lands in the People folder.
 * Throws when the name is empty or already a Person's there.
 */
export async function addPerson(input: { name: string; aliases?: string[]; relationship?: string; tags?: string[] }): Promise<Person> {
  const name = input.name.trim();
  if (!name) throw new Error("A Person needs a name");
  return (await createDocument({
    type: PERSON_TYPE,
    title: name,
    fields: { aliases: cleanAliases(input.aliases), relationship: input.relationship?.trim() ?? "", tags: normalizeTags(input.tags ?? []) },
  })) as Person;
}

export interface PersonPatch {
  title?: string;
  aliases?: string[];
  relationship?: string;
  tags?: string[];
  excludedFromDrifting?: boolean;
}

/**
 * Change a Person: only the patched keys, onto the stored row. A new name
 * renames them, rewriting every `[[link]]` to the old one.
 */
export async function patchPerson(id: string, patch: PersonPatch): Promise<void> {
  const { title, ...rest } = patch;
  if (title !== undefined) {
    if (!title.trim()) throw new Error("A Person needs a name");
    const doc = await getDocument(id);
    if (doc) await renameDocument(doc, title);
  }
  const fields: Record<string, unknown> = {};
  if (rest.aliases) fields.aliases = cleanAliases(rest.aliases);
  if (rest.relationship !== undefined) fields.relationship = rest.relationship.trim();
  if (rest.excludedFromDrifting !== undefined) fields.excludedFromDrifting = rest.excludedFromDrifting;
  if (rest.tags) fields.tags = normalizeTags(rest.tags);
  if (Object.keys(fields).length) await patchDocument(id, fields);
}

/**
 * Change a Person's Addresses: `change` is given the stored list and returns the
 * new one, so two quick edits never overwrite each other with a stale copy.
 */
export const updateAddresses = (id: string, change: (list: Address[]) => Address[]) => updateParts(id, "addresses", change);

/** Change a Person's Contact details the same way: `change` is given the stored list. */
export const updateContactDetails = (id: string, change: (list: ContactDetail[]) => ContactDetail[]) => updateParts(id, "contactDetails", change);
