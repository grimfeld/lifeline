import { useMemo } from "react";
import { PERSON_TYPE, createDocument, documentsOfUngated, getDocument, normalizeTags, patchDocument, removeDocument, renameDocument, useDocuments, type Document } from "@lifeline/core";
import { HOUSEHOLD, type Household, type Membership } from "../domain/types";
import { hasMember, membershipsOf, normalizeMembership } from "../domain/households";
import { cleanAliases } from "../domain/person";
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

/** Add a Household: a name is all it takes. Lands in its folder, with no members. Throws when the name is empty or taken there. */
export async function addHousehold(input: { name: string; aliases?: string[]; tags?: string[] }): Promise<Household> {
  const name = input.name.trim();
  if (!name) throw new Error("A Household needs a name.");
  return normalizeHousehold(
    (await createDocument({ type: HOUSEHOLD, title: name, fields: { aliases: cleanAliases(input.aliases), members: [], tags: normalizeTags(input.tags ?? []) } })) as Household,
  );
}

/** Change a Household's name (every `[[link]]` to it follows), its aliases or its Tags: only the keys given. */
export async function patchHousehold(id: string, patch: { title?: string; aliases?: string[]; tags?: string[] }): Promise<void> {
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new Error("A Household needs a name.");
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
  if (hasMember(household, personId)) return;
  await patchDocument(householdId, { members: [...members, { personId }] });
}

/**
 * Set a membership's since and until days (ADR 0117), each a `YYYY-MM-DD` day
 * or "" for none; the keys left out stay as they are. Someone who moves out
 * gets an until day and stays listed. Throws when until comes before since.
 */
export async function setMembershipDays(householdId: string, personId: string, days: { since?: string; until?: string }): Promise<void> {
  const { members } = await membershipsIn(householdId);
  const current = members.find((m) => m.personId === personId);
  if (!current) throw new Error("They are not in it");
  const since = days.since === undefined ? current.since : days.since;
  const until = days.until === undefined ? current.until : days.until;
  if (since && until && until < since) throw new Error("Until comes before since");
  const next = normalizeMembership(personId, since, until);
  await patchDocument(householdId, { members: members.map((m) => (m.personId === personId ? next : m)) });
}

/** Make a Household of that name and the Person its first member: "Add to a household…" on their page, with a new one. */
export async function joinNewHousehold(personId: string, name: string): Promise<Household> {
  const household = await addHousehold({ name });
  try {
    await addMember(household.id, personId);
  } catch (e) {
    // Never leave the Household behind empty: a retry would find its name taken.
    await removeDocument(household.id);
    throw e;
  }
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
    if (!hasMember(h, personId)) continue;
    await patchDocument(h.id, { members: membershipsOf(h.members).filter((m) => m.personId !== personId), workspace: h.workspace ?? "" });
  }
}

/**
 * What goes when a Person moves to another Workspace: their place in every
 * Household outside it (ADR 0117: members belong to the Household's own
 * Workspace). Those in the new Workspace keep them.
 */
export async function dropMembershipsOutside(personId: string, workspace: string): Promise<void> {
  for (const h of await documentsOfUngated<Household>([HOUSEHOLD])) {
    if ((h.workspace ?? "") === workspace || !hasMember(h, personId)) continue;
    await patchDocument(h.id, { members: membershipsOf(h.members).filter((m) => m.personId !== personId), workspace: h.workspace ?? "" });
  }
}

/** What goes when a Household moves to another Workspace: its members who are not in it. */
export async function dropMembersOutside(householdId: string, workspace: string): Promise<void> {
  const household = (await documentsOfUngated<Household>([HOUSEHOLD])).find((h) => h.id === householdId);
  if (!household) return;
  const there = new Set((await documentsOfUngated([PERSON_TYPE])).filter((p) => (p.workspace ?? "") === workspace).map((p) => p.id));
  const members = membershipsOf(household.members);
  const kept = members.filter((m) => there.has(m.personId));
  if (kept.length < members.length) await patchDocument(householdId, { members: kept, workspace });
}
