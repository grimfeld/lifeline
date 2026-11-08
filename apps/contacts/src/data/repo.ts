import { createDocument, getDocument, normalizeTags, patchDocument, renameDocument } from "@lifeline/core";
import { PERSON, type ContactDetail, type Person } from "../domain/types";

/** A Person as stored, with the App's keys filled in for a row written before they existed. */
export function normalizePerson(doc: Person): Person {
  return { ...doc, aliases: Array.isArray(doc.aliases) ? doc.aliases : [], relationship: typeof doc.relationship === "string" ? doc.relationship : "" };
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
    type: PERSON,
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
  if (rest.tags) fields.tags = normalizeTags(rest.tags);
  if (rest.contactDetails) fields.contactDetails = rest.contactDetails;
  if (Object.keys(fields).length) await patchDocument(id, fields);
}
