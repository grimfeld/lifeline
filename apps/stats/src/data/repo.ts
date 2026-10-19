import { documentsOf, documentsWhere, getDocument, normalizeTags, putDocument, removeDocument, useLiveQuery } from "@lifeline/core";
import { cleanItemList, normalizeItem } from "../domain/aggregate";
import { STAT, STAT_ENTRY, type ColorSlot, type Entry, type Stat, type StatKind } from "../domain/types";

/** PocketBase stores an absent text/number as "" / 0; re-establish the domain's defaults on read. */
function normalizeStat(s: Stat): Stat {
  return { ...s, unit: s.unit ?? "", defaultIncrement: s.defaultIncrement || 0, universeSize: s.universeSize || 0, items: Array.isArray(s.items) ? s.items : [], tags: s.tags ?? [] };
}
function normalizeEntry(e: Entry): Entry {
  return { ...e, item: e.item ?? "", tags: e.tags ?? [] };
}

/** Stats in creation order (notch: no manual reorder, no archive). */
export function useStats(): Stat[] {
  return useLiveQuery(
    async () =>
      (await documentsOf<Stat>(STAT))
        .map(normalizeStat)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.updatedAt.localeCompare(b.updatedAt)),
    [],
    [] as Stat[],
  );
}

export async function allStats(): Promise<Stat[]> {
  return (await documentsOf<Stat>(STAT)).map(normalizeStat);
}

/** All entries, all-time: streaks and distinct counts need history, and personal scale is small. */
export function useEntries(): Entry[] {
  return useLiveQuery(
    async () => (await documentsOf<Entry>(STAT_ENTRY)).map(normalizeEntry),
    [],
    [] as Entry[],
  );
}

export function useStat(id: string | undefined): Stat | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return undefined;
      const s = await getDocument<Stat>(id);
      return s && s.type === STAT ? normalizeStat(s) : undefined;
    },
    [id],
    undefined,
  );
}

export function useStatEntries(statId: string | undefined): Entry[] {
  return useLiveQuery(
    async () =>
      statId ? (await documentsWhere<Entry>(STAT_ENTRY, "statId", statId)).map(normalizeEntry) : [],
    [statId],
    [] as Entry[],
  );
}

export function entriesByStat(entries: Entry[]): Map<string, Entry[]> {
  const m = new Map<string, Entry[]>();
  for (const e of entries) {
    const arr = m.get(e.statId);
    if (arr) arr.push(e);
    else m.set(e.statId, [e]);
  }
  return m;
}

export interface StatInput {
  title: string;
  kind: StatKind;
  unit: string;
  color: ColorSlot;
  defaultIncrement: number;
  universeSize: number;
  items: string[];
  tags: string[];
}

/** Fields irrelevant to the kind are zeroed so they can't leak meaning. */
function scrub(input: StatInput): StatInput {
  const k = input.kind;
  return {
    ...input,
    unit: k === "additive" || k === "measurement" ? input.unit.trim() : "",
    defaultIncrement: k === "additive" ? input.defaultIncrement || 0 : 0,
    universeSize: k === "collection" ? input.universeSize || 0 : 0,
    items: k === "collection" ? cleanItemList(input.items) : [],
    tags: normalizeTags(input.tags),
  };
}

export async function addStat(input: StatInput): Promise<string> {
  const row = await putDocument<Stat>({ type: STAT, ...scrub(input) });
  return row.id;
}

/** Kind is fixed after creation — the input's kind is ignored in favour of the stored one. */
export async function updateStat(stat: Stat, input: Omit<StatInput, "kind">): Promise<void> {
  await putDocument<Stat>({ ...stat, ...scrub({ ...input, kind: stat.kind }) });
}

/** Deleting a stat deletes every entry with it. */
export async function deleteStat(statId: string): Promise<void> {
  const entries = await documentsWhere<Entry>(STAT_ENTRY, "statId", statId);
  for (const e of entries) await removeDocument(e.id);
  await removeDocument(statId);
}

export async function addEntry(input: { statId: string; value: number; ts: string; item?: string }): Promise<void> {
  await putDocument<Entry>({
    type: STAT_ENTRY,
    statId: input.statId,
    value: input.value,
    item: input.item?.trim() ?? "",
    ts: input.ts,
  });
}

export async function deleteEntry(id: string): Promise<void> {
  await removeDocument(id);
}

/** Untick a Collection item: every entry of it goes (duplicates included), the preset list is untouched. */
export async function uncollectItem(statId: string, item: string): Promise<void> {
  const key = normalizeItem(item);
  const entries = await documentsWhere<Entry>(STAT_ENTRY, "statId", statId);
  for (const e of entries) if (e.item && normalizeItem(e.item) === key) await removeDocument(e.id);
}
