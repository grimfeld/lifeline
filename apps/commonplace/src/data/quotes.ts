import { useMemo } from "react";
import { documentsWhere, getDocument, normalizeTags, patchDocument, putDocument, removeDocument, todayStr, useDocuments } from "@lifeline/core";
import { QUOTES, QUOTES_FOLDER, type Quote } from "../domain/types";

function normalize(q: Quote): Quote {
  return { ...q, body: typeof q.body === "string" ? q.body : "", source: q.source ?? "", locator: q.locator ?? "", comment: q.comment ?? "", capturedOn: q.capturedOn ?? "", kept: !!q.kept, topic: q.topic ?? "", keptAt: q.keptAt ?? "", tags: q.tags ?? [] };
}

export function useQuotes(): Quote[] {
  const rows = useDocuments<Quote>(QUOTES);
  return useMemo(() => rows.map(normalize), [rows]);
}

/** Keep a passage from a Source (ADR 0070). `title` is for a kept text that has a headline of its own; otherwise the opening words name it. */
export async function addQuote(input: { source: string; text: string; locator?: string; comment?: string; tags?: string[]; title?: string; capturedOn?: string }): Promise<Quote> {
  if (!input.source) throw new Error("A Quote needs its Source");
  const text = input.text.trim();
  if (!text) throw new Error("Write the quote");
  return putDocument<Quote>({
    type: QUOTES,
    title: input.title?.trim() || undefined,
    folder: QUOTES_FOLDER,
    source: input.source,
    body: text + "\n",
    locator: (input.locator ?? "").trim(),
    comment: (input.comment ?? "").trim(),
    capturedOn: input.capturedOn ?? todayStr(),
    tags: normalizeTags(input.tags ?? []),
  } as Parameters<typeof putDocument<Quote>>[0]);
}

export async function updateQuote(q: Quote): Promise<void> {
  // Title is derived from the passage; clear it so putDocument re-derives.
  await putDocument<Quote>({ ...q, type: QUOTES, title: "", body: q.body.trim() + "\n", tags: normalizeTags(q.tags ?? []) });
}

/**
 * Keep a Quote (CONTEXT.md "Quote"): into Practice, in a Topic. The first
 * keep sets its Topic for good — like a Word's, so its Recalls stay counted
 * in one Topic — and keeping it again after unkeeping returns it there.
 */
export async function keepQuote(id: string, topicId: string): Promise<void> {
  const q = await getDocument<Quote>(id);
  if (!q) return;
  const topic = q.topic || topicId;
  if (!topic) throw new Error("Pick a topic to keep it in");
  await patchDocument(id, { kept: true, topic, keptAt: q.keptAt || new Date().toISOString() });
}

/** Out of every Practice; its Topic and Recalls are kept, as pausing keeps a Word's. */
export async function unkeepQuote(id: string): Promise<void> {
  await patchDocument(id, { kept: false });
}

export async function deleteQuote(id: string): Promise<void> {
  await removeDocument(id);
}

/** Every Quote taken from one Source. */
export async function quotesOf(source: string): Promise<Quote[]> {
  return (await documentsWhere<Quote>(QUOTES, "source", source)).map(normalize);
}
