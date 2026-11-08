import { allDocuments, documentTypeSync, getDocument, putDocument, ROLES_KEY, roleDef, type Document, type DocumentInput } from "@lifeline/core";

/**
 * The Contacts App's Person type id (ADR 0113). Library and Museum never
 * import Contacts (ADR 0003), so they reach the type by this id, through Core.
 */
export const PERSON_TYPE_ID = "contacts_person";

/** Whether a Document can be turned into a Person: it is a bare Author or Artist (the Role's home type), and Contacts is in this build. */
export function canTurnIntoPerson(doc: Pick<Document, "type">, roleId: string): boolean {
  const role = roleDef(roleId);
  return !!role && doc.type === role.homeType && !!documentTypeSync(PERSON_TYPE_ID);
}

/**
 * Turn an Author or Artist into a Person (CONTEXT.md "Person", ADR 0113): the
 * Document keeps its id, links, aliases, body, folder and Fields, but its type
 * becomes the Person and it wears the Role, so its works still link to it.
 * Core has no retype operation, so this is one write. Throws when the
 * Document is not that Role's home type, or a Person of that name is already
 * in its folder. Returns the Person.
 */
export async function turnIntoPerson(id: string, roleId: string): Promise<Document> {
  const doc = await getDocument(id);
  const role = roleDef(roleId);
  if (!doc || !role) throw new Error("Not found");
  if (doc.type !== role.homeType) throw new Error(`Only an ${role.label} can be turned into a Person`);
  if (!documentTypeSync(PERSON_TYPE_ID)) throw new Error("People is not available");
  const key = doc.title.trim().toLowerCase();
  const taken = (await allDocuments()).some((d) => d.type === PERSON_TYPE_ID && !d.deleted && d.folder === doc.folder && d.title.trim().toLowerCase() === key);
  if (taken) throw new Error(`A Person named “${doc.title}” already exists in ${doc.folder || "the root"}`);
  const worn = Array.isArray(doc[ROLES_KEY]) ? (doc[ROLES_KEY] as string[]) : [];
  return putDocument({ ...doc, type: PERSON_TYPE_ID, [ROLES_KEY]: worn.includes(roleId) ? worn : [...worn, roleId] } as DocumentInput);
}
