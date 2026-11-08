import { PERSON_TYPE, createDocument, documentsOf, getDocument, newId, normalizeTags, patchDocument, renameDocument, useDocuments } from "@lifeline/core";
import { type Address, type ContactDetail, type Occasion, type Person } from "../domain/types";
import { normalizeAddresses } from "../domain/addresses";
import { normalizeOccasions, occasionProblem } from "../domain/occasions";
import { findPerson } from "../domain/person";

/** A Person as stored, with the App's keys filled in for a row written before they existed. */
export function normalizePerson(doc: Person): Person {
  return { ...doc, aliases: Array.isArray(doc.aliases) ? doc.aliases : [], relationship: typeof doc.relationship === "string" ? doc.relationship : "", excludedFromDrifting: doc.excludedFromDrifting === true, occasions: normalizeOccasions(doc.occasions), addresses: normalizeAddresses(doc.addresses) };
}

/** Every Person in the Workspace, live. */
export const usePeople = () => useDocuments<Person>(PERSON_TYPE);

/** Every Person in the Workspace, read once. */
export const allPeople = () => documentsOf<Person>(PERSON_TYPE);

export type OccasionInput = Pick<Occasion, "label" | "day" | "yearly">;

const cleaned = (o: OccasionInput): OccasionInput => ({ label: o.label.trim(), day: o.day.trim(), yearly: o.yearly });

async function occasionsOf(personId: string): Promise<Occasion[]> {
  const doc = await getDocument(personId);
  if (!doc || doc.type !== PERSON_TYPE) throw new Error("No such person");
  return normalizeOccasions((doc as Person).occasions);
}

/** Add an Occasion to a Person; throws in words when it is not one (an empty label, no real day, a once one with no year). */
export async function addOccasion(personId: string, input: OccasionInput): Promise<Occasion> {
  const o = cleaned(input);
  const problem = occasionProblem(o);
  if (problem) throw new Error(problem);
  const occasion = { id: newId(), ...o };
  await patchDocument(personId, { occasions: [...(await occasionsOf(personId)), occasion] });
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
  const o = cleaned(input);
  const problem = occasionProblem(o);
  if (problem) throw new Error(problem);
  const all = await occasionsOf(personId);
  if (!all.some((x) => x.id === id)) throw new Error("No such occasion");
  await patchDocument(personId, { occasions: all.map((x) => (x.id === id ? { id, ...o } : x)) });
}

/** Remove an Occasion from a Person. */
export async function removeOccasion(personId: string, id: string): Promise<void> {
  await patchDocument(personId, { occasions: (await occasionsOf(personId)).filter((x) => x.id !== id) });
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
  contactDetails?: ContactDetail[];
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
  if (rest.contactDetails) fields.contactDetails = rest.contactDetails;
  if (Object.keys(fields).length) await patchDocument(id, fields);
}

/**
 * Change a Person's Addresses: `change` is given the stored list and returns the
 * new one, so two quick edits never overwrite each other with a stale copy.
 */
export async function updateAddresses(id: string, change: (list: Address[]) => Address[]): Promise<void> {
  const doc = await getDocument(id);
  if (!doc) throw new Error("No such Person");
  await patchDocument(id, { addresses: change(normalizeAddresses(doc.addresses)) });
}
