import { allDocuments, documentTypeSync, getDocument, PERSON_TYPE, putDocument, ROLES_KEY, roleDef, type Document, type DocumentInput } from "@lifeline/core";

/** Whether a Document can be turned into a Person: it is a bare Author or Artist (the Role's home type), and Contacts is in this build. */
export function canTurnIntoPerson(doc: Pick<Document, "type">, roleId: string): boolean {
  const role = roleDef(roleId);
  return !!role && doc.type === role.homeType && !!documentTypeSync(PERSON_TYPE);
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
  if (!documentTypeSync(PERSON_TYPE)) throw new Error("People is not available");
  if (await personNamed(doc)) throw new Error(`A Person named “${doc.title}” already exists in ${doc.folder || "the root"}`);
  return putDocument({ ...doc, type: PERSON_TYPE, [ROLES_KEY]: wearing(doc, roleId) } as DocumentInput);
}

/** Whether a live Person in the Document's folder already has its name (whatever its case or surrounding spaces). */
async function personNamed(doc: Document): Promise<boolean> {
  const key = nameKey(doc.title);
  return (await allDocuments()).some((d) => d.type === PERSON_TYPE && !d.deleted && d.folder === doc.folder && nameKey(d.title) === key);
}

const nameKey = (title: string): string => title.trim().toLowerCase();

/** The Roles a Document wears, `roleId` among them once. */
function wearing(doc: Document, roleId: string): string[] {
  const worn = Array.isArray(doc[ROLES_KEY]) ? (doc[ROLES_KEY] as string[]) : [];
  return worn.includes(roleId) ? worn : [...worn, roleId];
}
