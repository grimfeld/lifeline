import { useMemo } from "react";
import { PERSON_TYPE, createDocument, documentsOf, documentsOfUngated, getDocument, normalizeTags, patchDocument, renameDocument, useDocuments, type Document } from "@lifeline/core";
import { HOUSEHOLD, type Household, type Membership } from "../domain/types";
import { membershipsOf } from "../domain/households";
import type { Removed } from "./repo";

/** A Household as stored, with its keys well-formed whatever a Base wrote. */
export const normalizeHousehold = (doc: Household): Household => ({ ...doc, aliases: Array.isArray(doc.aliases) ? doc.aliases : [], members: membershipsOf(doc.members) });

/** A row as the Household page shows it: none when it is missing, deleted, or no Household. */
export const liveHousehold = (row: Document | undefined): Household | undefined => (row && !row.deleted && row.type === HOUSEHOLD ? normalizeHousehold(row as Household) : undefined);

/** Every Household in the Workspace, live. */
export function useHouseholds(): Household[] {
  const docs = useDocuments<Household>(HOUSEHOLD);
  return useMemo(() => docs.map(normalizeHousehold), [docs]);
}

/** Every Household in the Workspace, read once. */
export const allHouseholds = async () => (await documentsOf<Household>(HOUSEHOLD)).map(normalizeHousehold);

const cleanAliases = (aliases: readonly string[] | undefined) => (aliases ?? []).map((a) => a.trim()).filter(Boolean);

/** Add a Household: a name is all it takes. Lands in its folder, with no members. Throws when the name is empty or taken there. */
export async function addHousehold(input: { name: string; aliases?: string[]; tags?: string[] }): Promise<Household> {
  const name = input.name.trim();
  if (!name) throw new Error("A Household needs a name");
  return normalizeHousehold(
    (await createDocument({ type: HOUSEHOLD, title: name, fields: { aliases: cleanAliases(input.aliases), members: [], tags: normalizeTags(input.tags ?? []) } })) as Household,
  );
}

/** Change a Household's name (every `[[link]]` to it follows), its aliases or its Tags: only the keys given. */
export async function patchHousehold(id: string, patch: { title?: string; aliases?: string[]; tags?: string[] }): Promise<void> {
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new Error("A Household needs a name");
    const doc = await getDocument(id);
    if (doc) await renameDocument(doc, patch.title);
  }
  const fields: Record<string, unknown> = {};
  if (patch.aliases) fields.aliases = cleanAliases(patch.aliases);
  if (patch.tags) fields.tags = normalizeTags(patch.tags);
  if (Object.keys(fields).length) await patchDocument(id, fields);
}

async function membershipsIn(householdId: string): Promise<{ household: Document; members: Membership[] }> {
  const household = await getDocument(householdId);
  if (!household || household.type !== HOUSEHOLD) throw new Error("No such Household");
  return { household, members: membershipsOf(household.members) };
}

/**
 * Make a Person a member (ADR 0117: chosen, never matched). Only a Person
 * visible in the Household's own Workspace can be one; one already a member
 * stays as they are.
 */
export async function addMember(householdId: string, personId: string): Promise<void> {
  const { household, members } = await membershipsIn(householdId);
  const person = await getDocument(personId);
  if (!person || person.type !== PERSON_TYPE || (person.workspace ?? "") !== (household.workspace ?? "")) throw new Error("Only a Person of this Workspace can be a member");
  if (members.some((m) => m.personId === personId)) return;
  await patchDocument(householdId, { members: [...members, { personId }] });
}

/** Make a Household of that name and the Person its first member: "Add to a Household…" on their page, with a new one. */
export async function joinNewHousehold(personId: string, name: string): Promise<Household> {
  const household = await addHousehold({ name });
  await addMember(household.id, personId);
  return { ...household, members: [{ personId }] };
}

/** Take a Person out of a Household, handing back what Undo needs (`restoreMember`). */
export async function removeMember(householdId: string, personId: string): Promise<Removed<Membership>> {
  const { members } = await membershipsIn(householdId);
  const index = members.findIndex((m) => m.personId === personId);
  if (index < 0) throw new Error("They are already out of it");
  await patchDocument(householdId, { members: members.filter((m) => m.personId !== personId) });
  return { entry: members[index]!, index };
}

/** Undo `removeMember`: that membership back where it stood, its days with it. */
export async function restoreMember(householdId: string, removed: Removed<Membership>): Promise<void> {
  const { members } = await membershipsIn(householdId);
  if (members.some((m) => m.personId === removed.entry.personId)) return;
  const at = Math.min(Math.max(removed.index, 0), members.length);
  await patchDocument(householdId, { members: [...members.slice(0, at), removed.entry, ...members.slice(at)] });
}

/**
 * What goes when a Person is deleted: their place in every Household, of any
 * Workspace. The Households stay, with their other members.
 */
export async function dropMembershipsOf(personId: string): Promise<void> {
  for (const h of await documentsOfUngated<Household>([HOUSEHOLD])) {
    const members = membershipsOf(h.members);
    if (!members.some((m) => m.personId === personId)) continue;
    await patchDocument(h.id, { members: members.filter((m) => m.personId !== personId), workspace: h.workspace ?? "" });
  }
}
