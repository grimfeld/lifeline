import { useMemo } from "react";
import { normalizeTags, putDocument, removeDocument, todayStr, useDocuments } from "@lifeline/core";
import { QUOTES, type Quote } from "../domain/types";

function normalize(q: Quote): Quote {
  return { ...q, text: q.text ?? "", locator: q.locator ?? "", comment: q.comment ?? "", capturedOn: q.capturedOn ?? "", tags: q.tags ?? [] };
}

export function useQuotes(): Quote[] {
  const rows = useDocuments<Quote>(QUOTES);
  return useMemo(() => rows.map(normalize), [rows]);
}

export async function addQuote(input: { mediaId: string; text: string; locator?: string; comment?: string; tags?: string[] }): Promise<Quote> {
  return putDocument<Quote>({
    type: QUOTES,
    mediaId: input.mediaId,
    text: input.text.trim(),
    locator: (input.locator ?? "").trim(),
    comment: (input.comment ?? "").trim(),
    capturedOn: todayStr(),
    tags: normalizeTags(input.tags ?? []),
  });
}

export async function updateQuote(q: Quote): Promise<void> {
  // Title is derived from the text; clear it so putDocument re-derives.
  await putDocument<Quote>({ ...q, type: QUOTES, title: "", text: q.text.trim(), tags: normalizeTags(q.tags ?? []) });
}

export async function deleteQuote(id: string): Promise<void> {
  await removeDocument(id);
}
