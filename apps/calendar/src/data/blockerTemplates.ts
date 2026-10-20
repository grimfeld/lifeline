import { useMemo } from "react";
import { documentsOf, getDocument, normalizeTags, putDocument, removeDocument, useDocuments, type DateStr, type TimeStr } from "@lifeline/core";
import { DEFAULT_DURATION_MIN, durationOf, endOf } from "../domain/templates";
import { BLOCKER_TEMPLATE_TYPE, type BlockerTemplate } from "../domain/types";
import { addTimeBlocker } from "./blockers";

/** PocketBase returns absent text fields as ""; re-establish null/defaults on read. */
function normalize(t: BlockerTemplate): BlockerTemplate {
  return { ...t, durationMin: durationOf(t), color: t.color || null, tags: t.tags ?? [] };
}

function compare(a: BlockerTemplate, b: BlockerTemplate): number {
  return a.title.localeCompare(b.title);
}

export function useBlockerTemplates(): BlockerTemplate[] {
  const rows = useDocuments<BlockerTemplate>(BLOCKER_TEMPLATE_TYPE);
  return useMemo(() => rows.map(normalize).sort(compare), [rows]);
}

export async function allBlockerTemplates(): Promise<BlockerTemplate[]> {
  return (await documentsOf<BlockerTemplate>(BLOCKER_TEMPLATE_TYPE)).map(normalize);
}

export async function addBlockerTemplate(input: { title: string; durationMin?: number; color?: string | null; tags?: string[] }): Promise<string> {
  const row = await putDocument<BlockerTemplate>({
    type: BLOCKER_TEMPLATE_TYPE,
    title: input.title,
    durationMin: input.durationMin ?? DEFAULT_DURATION_MIN,
    color: input.color ?? null,
    tags: normalizeTags(input.tags ?? []),
  });
  return row.id;
}

export async function updateBlockerTemplate(t: BlockerTemplate): Promise<void> {
  await putDocument<BlockerTemplate>({ ...t, type: BLOCKER_TEMPLATE_TYPE, tags: normalizeTags(t.tags ?? []) });
}

export async function deleteBlockerTemplate(id: string): Promise<void> {
  await removeDocument(id);
}

/**
 * Drop (ADR 0029): the one-off Time blocker a template describes, on a day
 * at a slot. Unlike an Event template there is no all-day fallback — a band
 * without hours is no band — so a missing start lands at 09:00.
 */
export async function addBlockerFromTemplate(templateId: string, date: DateStr, start: TimeStr | null = null): Promise<{ id: string; title: string; start: TimeStr } | null> {
  const row = await getDocument<BlockerTemplate>(templateId);
  if (!row) return null;
  const t = normalize(row);
  const at = start ?? "09:00";
  const id = await addTimeBlocker({ title: t.title, date, weekdays: [], start: at, ...endOf(t, date, at), color: t.color, tags: t.tags });
  return { id, title: t.title, start: at };
}
