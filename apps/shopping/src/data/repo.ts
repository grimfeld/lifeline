import { useMemo } from "react";
import { addDays, documentsOf, patchDocument, putDocument, removeDocument, todayStr, useDocuments } from "@lifeline/core";
import { AISLE, NEED, type Aisle, type Need } from "../domain/types";
import { addOutcome, appendNote, moveAisle, nextRank, renameClash, sortAisles } from "../domain/rules";

/**
 * PocketBase stores absent fields as "" / 0 and hands them back that way,
 * so every read re-establishes the domain's defaults.
 */
export function normalizeNeed(n: Need): Need {
  return { ...n, aisleId: n.aisleId ?? "", note: n.note ?? "", boughtOn: n.boughtOn ?? "", listedAt: n.listedAt ?? "", tags: n.tags ?? [] };
}

export function normalizeAisle(a: Aisle): Aisle {
  return { ...a, rank: Number(a.rank) || 0, tags: a.tags ?? [] };
}

export function useNeeds(): Need[] {
  const rows = useDocuments<Need>(NEED);
  return useMemo(() => rows.map(normalizeNeed), [rows]);
}

export function useAisles(): Aisle[] {
  const rows = useDocuments<Aisle>(AISLE);
  return useMemo(() => sortAisles(rows.map(normalizeAisle)), [rows]);
}

export const allNeeds = async () => (await documentsOf<Need>(NEED)).map(normalizeNeed);
const now = () => new Date().toISOString();

export type AddResult = { kind: "new" | "revive" | "listed"; id: string } | null;

/**
 * Add a Need (ADR 0055): a new title makes one; a Bought title brings the
 * same Need back, Aisle and note and all (an Aisle or note typed now wins);
 * a title already listed makes nothing — a typed note is added to its note.
 */
export async function addNeed(input: { title: string; note?: string; aisleId?: string }): Promise<AddResult> {
  const title = input.title.trim();
  if (!title) return null;
  const note = (input.note ?? "").trim();
  const aisleId = input.aisleId ?? "";
  const out = addOutcome(await allNeeds(), title);
  if (out.kind === "listed") {
    const merged = appendNote(out.need.note, note);
    if (merged !== out.need.note) await patchDocument(out.need.id, { note: merged });
    return { kind: "listed", id: out.need.id };
  }
  if (out.kind === "revive") {
    await patchDocument(out.need.id, { boughtOn: "", listedAt: now(), ...(note ? { note } : {}), ...(aisleId ? { aisleId } : {}) });
    return { kind: "revive", id: out.need.id };
  }
  const row = await putDocument<Need>({ type: NEED, title, note, aisleId, boughtOn: "", listedAt: now() });
  return { kind: "new", id: row.id };
}

/** The tick in the shop: Bought today, kept. */
export const markBought = (id: string) => patchDocument(id, { boughtOn: todayStr() });

/** Undo a tick: back on the list where it was. */
export const unmarkBought = (id: string) => patchDocument(id, { boughtOn: "" });

/** Edit a Need; renaming onto another Need's title is refused (false). */
export async function saveNeed(id: string, patch: { title: string; note: string; aisleId: string }): Promise<boolean> {
  const title = patch.title.trim();
  if (!title || renameClash(await allNeeds(), id, title)) return false;
  await patchDocument(id, { title, note: patch.note.trim(), aisleId: patch.aisleId });
  return true;
}

/** Set a Need's note or Aisle where it is peeked; the title stays the dialog's, which refuses a clash. */
export const patchNeed = (id: string, patch: Partial<Pick<Need, "note" | "aisleId">>) =>
  patchDocument(id, patch.note === undefined ? patch : { ...patch, note: patch.note.trim() });

/** Forgets it for good — how a one-off stops being offered back. */
export const deleteNeed = (id: string) => removeDocument(id);

export async function addAisle(title: string): Promise<string> {
  const aisles = (await documentsOf<Aisle>(AISLE)).map(normalizeAisle);
  const row = await putDocument<Aisle>({ type: AISLE, title: title.trim(), rank: nextRank(aisles) });
  return row.id;
}

export const renameAisle = (id: string, title: string) => patchDocument(id, { title: title.trim() });

/** Never blocked: the Aisle type's onDelete moves its Needs to Anywhere. */
export const deleteAisle = (id: string) => removeDocument(id);

export async function shiftAisle(aisles: Aisle[], id: string, dir: -1 | 1): Promise<void> {
  for (const r of moveAisle(aisles, id, dir)) await patchDocument(r.id, { rank: r.rank });
}

/** Cascade for a deleted Aisle, from wherever it is deleted: its Needs become buyable anywhere. */
export async function releaseAisle(aisleId: string): Promise<void> {
  for (const n of await allNeeds()) if (n.aisleId === aisleId) await patchDocument(n.id, { aisleId: "" });
}

/** First day of the "Bought recently" strip. */
export const recentSince = (days: number) => addDays(todayStr(), -days);
