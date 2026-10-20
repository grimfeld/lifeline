import { useMemo } from "react";
import { documentsOf, getDocument, normalizeTags, putDocument, removeDocument, useDocuments, type DateStr, type TimeStr } from "@lifeline/core";
import { compareTemplates, DEFAULT_DURATION_MIN, durationOf, endOf } from "../domain/templates";
import { EVENT_TEMPLATE_TYPE, type EventTemplate } from "../domain/types";
import { addEvent } from "./repo";

/** PocketBase returns absent text fields as ""; re-establish null/defaults on read. */
function normalize(t: EventTemplate): EventTemplate {
  return {
    ...t,
    notes: t.notes ?? "",
    defaultStart: t.defaultStart || null,
    durationMin: durationOf(t),
    allDay: !!t.allDay,
    tags: t.tags ?? [],
  };
}

export function useEventTemplates(): EventTemplate[] {
  const rows = useDocuments<EventTemplate>(EVENT_TEMPLATE_TYPE);
  return useMemo(() => rows.map(normalize).sort(compareTemplates), [rows]);
}

export async function allEventTemplates(): Promise<EventTemplate[]> {
  return (await documentsOf<EventTemplate>(EVENT_TEMPLATE_TYPE)).map(normalize);
}

export async function addEventTemplate(input: {
  title: string;
  notes?: string;
  defaultStart?: TimeStr | null;
  durationMin?: number;
  allDay?: boolean;
  tags?: string[];
}): Promise<string> {
  const allDay = !!input.allDay;
  const row = await putDocument<EventTemplate>({
    type: EVENT_TEMPLATE_TYPE,
    title: input.title,
    notes: input.notes ?? "",
    defaultStart: allDay ? null : input.defaultStart || null,
    durationMin: allDay ? DEFAULT_DURATION_MIN : (input.durationMin ?? DEFAULT_DURATION_MIN),
    allDay,
    tags: normalizeTags(input.tags ?? []),
  });
  return row.id;
}

export async function updateEventTemplate(t: EventTemplate): Promise<void> {
  await putDocument<EventTemplate>({ ...t, type: EVENT_TEMPLATE_TYPE, tags: normalizeTags(t.tags ?? []) });
}

export async function deleteEventTemplate(id: string): Promise<void> {
  await removeDocument(id);
}

/**
 * Quick add (ADR 0027): the Event a template describes, on a day. An
 * explicit `start` wins (the slot the user dropped it on); otherwise the
 * template's own preferred start, and an all-day Event when it has none.
 */
export async function addEventFromTemplate(templateId: string, date: DateStr, start: TimeStr | null = null): Promise<{ id: string; title: string; start: TimeStr | null } | null> {
  const row = await getDocument<EventTemplate>(templateId);
  if (!row) return null;
  const t = normalize(row);
  const at = t.allDay ? null : (start ?? t.defaultStart);
  const id = await addEvent({
    title: t.title,
    notes: t.notes,
    date,
    start: at,
    ...(at ? endOf(t, date, at) : { end: null }),
    tags: t.tags,
  });
  return { id, title: t.title, start: at };
}
