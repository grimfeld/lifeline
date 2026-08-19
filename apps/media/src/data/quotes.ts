import { db, newId, normalizeTags, put, remove, todayStr, useLiveQuery } from "@lifeline/core";
import { QUOTES, type Quote } from "../domain/types";

function normalize(q: Quote): Quote {
  return { ...q, text: q.text ?? "", locator: q.locator ?? "", comment: q.comment ?? "", capturedOn: q.capturedOn ?? "", tags: q.tags ?? [] };
}

export function useQuotes(): Quote[] {
  return useLiveQuery(async () => (await db().collection<Quote>(QUOTES).where("deleted").equals(0).toArray()).map(normalize), [], [] as Quote[]);
}

export async function addQuote(input: { mediaId: string; text: string; locator?: string; comment?: string; tags?: string[] }): Promise<Quote> {
  const q: Quote = {
    id: newId(),
    mediaId: input.mediaId,
    text: input.text.trim(),
    locator: (input.locator ?? "").trim(),
    comment: (input.comment ?? "").trim(),
    capturedOn: todayStr(),
    tags: normalizeTags(input.tags ?? []),
    updatedAt: "",
    deleted: 0,
  };
  await put<Quote>(QUOTES, q);
  return q;
}

export async function updateQuote(q: Quote): Promise<void> {
  await put<Quote>(QUOTES, { ...q, text: q.text.trim(), tags: normalizeTags(q.tags ?? []) });
}

export async function deleteQuote(id: string): Promise<void> {
  await remove(QUOTES, id);
}

/** Tombstone every quote of a Media item (called when the item is deleted). */
export async function deleteQuotesOf(mediaId: string): Promise<void> {
  const qs = await db().collection<Quote>(QUOTES).where("mediaId").equals(mediaId).toArray();
  for (const q of qs) if (!q.deleted) await remove(QUOTES, q.id);
}
