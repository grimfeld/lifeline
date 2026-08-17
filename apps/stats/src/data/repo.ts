import { db, put, remove, newId, todayStr, useLiveQuery, normalizeTags } from "@lifeline/core";
import { ENTRIES, STATS, type ColorSlot, type Entry, type Stat, type StatKind } from "../domain/types";

function normalizeStat(s: Stat): Stat {
  return { ...s, unit: s.unit ?? "", defaultIncrement: s.defaultIncrement || 0, universeSize: s.universeSize || 0, tags: s.tags ?? [] };
}
function normalizeEntry(e: Entry): Entry {
  return { ...e, item: e.item ?? "" };
}

/** Stats in creation order (notch: no manual reorder, no archive). */
export function useStats(): Stat[] {
  return useLiveQuery(
    async () =>
      (await db().collection<Stat>(STATS).where("deleted").equals(0).toArray())
        .map(normalizeStat)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.updatedAt.localeCompare(b.updatedAt)),
    [],
    [] as Stat[],
  );
}

/** All entries, all-time: streaks and distinct counts need history, and personal scale is small. */
export function useEntries(): Entry[] {
  return useLiveQuery(
    async () => (await db().collection<Entry>(ENTRIES).where("deleted").equals(0).toArray()).map(normalizeEntry),
    [],
    [] as Entry[],
  );
}

export function useStat(id: string | undefined): Stat | undefined {
  return useLiveQuery(
    async () => {
      if (!id) return undefined;
      const s = await db().collection<Stat>(STATS).get(id);
      return s && !s.deleted ? normalizeStat(s) : undefined;
    },
    [id],
    undefined,
  );
}

export function useStatEntries(statId: string | undefined): Entry[] {
  return useLiveQuery(
    async () =>
      statId
        ? (await db().collection<Entry>(ENTRIES).where("statId").equals(statId).toArray())
            .filter((e) => !e.deleted)
            .map(normalizeEntry)
        : [],
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
  name: string;
  kind: StatKind;
  unit: string;
  color: ColorSlot;
  defaultIncrement: number;
  universeSize: number;
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
    tags: normalizeTags(input.tags),
  };
}

export async function addStat(input: StatInput): Promise<string> {
  const id = newId();
  await put<Stat>(STATS, { id, ...scrub(input), createdAt: todayStr() });
  return id;
}

/** Kind is fixed after creation — the input's kind is ignored in favour of the stored one. */
export async function updateStat(stat: Stat, input: Omit<StatInput, "kind">): Promise<void> {
  await put<Stat>(STATS, { ...stat, ...scrub({ ...input, kind: stat.kind }) });
}

/** Deleting a stat deletes every entry with it. */
export async function deleteStat(statId: string): Promise<void> {
  const entries = await db().collection<Entry>(ENTRIES).where("statId").equals(statId).toArray();
  for (const e of entries) if (!e.deleted) await remove(ENTRIES, e.id);
  await remove(STATS, statId);
}

export async function addEntry(input: { statId: string; value: number; ts: string; item?: string }): Promise<void> {
  await put<Entry>(ENTRIES, {
    id: newId(),
    statId: input.statId,
    value: input.value,
    item: input.item?.trim() ?? "",
    ts: input.ts,
  });
}

export async function deleteEntry(id: string): Promise<void> {
  await remove(ENTRIES, id);
}
