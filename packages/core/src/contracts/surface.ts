import { useLiveQuery } from "dexie-react-hooks";
import { db, type Placement } from "../data/db";
import { newId } from "../ids";
import { put, remove } from "../data/repo";
import { appById, schedulableProviders } from "../registry";
import { todayStr, type DateStr } from "../dates";
import type { SchedulableItem } from "./schedulable";
import { matchesTagFilter, type TagFilter } from "../tags";
import { useTagFilter } from "./tagfilter";

/** A Schedulable item resolved for display: placement pin > natural date; overdue rolled per owning App's policy. */
export interface SurfaceItem extends SchedulableItem {
  /** Day the surface should draw it on. */
  displayDate: DateStr;
  /** Set when a Placement pin, not the natural date, decided displayDate. */
  placementId?: string;
  color?: string;
}

/** An unplaced Schedulable item (natural date null): lives in the pool, not on a day. */
export interface PoolItem extends SchedulableItem {
  color?: string;
}

function useProviderItems(range: { start: DateStr; end: DateStr }) {
  const providers = schedulableProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  return providers.map((p) => ({
    provider: p,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    items: p.useItems(range),
  }));
}

/**
 * The read side of the Schedulable Contract, shared by every time surface
 * (month grid, week grid, Today feed). Collects items from all providers,
 * applies Placement pins, and rolls overdue items forward when the owning
 * App says so.
 */
export function useSurfaceItems(range: { start: DateStr; end: DateStr }, opts?: { tags?: TagFilter }): SurfaceItem[] {
  const ambient = useTagFilter();
  const filter = opts?.tags ?? ambient;
  const perProvider = useProviderItems(range);
  const placements = useLiveQuery(
    () => db().collection<Placement>("placements").where("deleted").equals(0).toArray(),
    [],
    [] as Placement[],
  );

  const today = todayStr();
  const byItem = new Map<string, Placement>();
  for (const pl of placements) byItem.set(`${pl.appId}/${pl.itemId}`, pl);

  const out: SurfaceItem[] = [];
  for (const { provider, items } of perProvider) {
    const color = appById(provider.appId)?.color;
    for (const item of items) {
      if (!matchesTagFilter(item.tags, filter)) continue;
      const pin = byItem.get(item.key);
      let displayDate = pin?.date ?? item.date;
      if (displayDate === null) continue; // unplaced pool item — see usePoolItems
      if (
        !item.completedOn &&
        displayDate < today &&
        provider.overduePolicy === "roll-forward" &&
        !pin
      ) {
        displayDate = today;
      }
      out.push({ ...item, displayDate, placementId: pin?.id, color });
    }
  }
  return out.filter((i) => i.displayDate >= range.start && i.displayDate <= range.end);
}

/**
 * Items no App has put on a day yet (natural date null, no pin) — the
 * "unplaced" column of a planning surface. Providers report pool items
 * regardless of the queried range, so any range works.
 */
export function usePoolItems(opts?: { tags?: TagFilter }): PoolItem[] {
  const ambient = useTagFilter();
  const filter = opts?.tags ?? ambient;
  const today = todayStr();
  const perProvider = useProviderItems({ start: today, end: today });
  const placements = useLiveQuery(
    () => db().collection<Placement>("placements").where("deleted").equals(0).toArray(),
    [],
    [] as Placement[],
  );
  const pinned = new Set(placements.map((pl) => `${pl.appId}/${pl.itemId}`));
  const out: PoolItem[] = [];
  for (const { provider, items } of perProvider) {
    const color = appById(provider.appId)?.color;
    for (const item of items) {
      if (item.date !== null || pinned.has(item.key) || item.completedOn) continue;
      if (!matchesTagFilter(item.tags, filter)) continue;
      out.push({ ...item, color });
    }
  }
  return out;
}

/** Pin an item to a day (or move an existing pin). */
export async function placeItem(appId: string, itemId: string, date: DateStr): Promise<void> {
  const existing = await db()
    .collection<Placement>("placements")
    .where("[appId+itemId]")
    .equals([appId, itemId])
    .first();
  await put<Placement>("placements", {
    id: existing?.id ?? newId(),
    appId,
    itemId,
    date,
  });
}

export async function unplaceItem(placementId: string): Promise<void> {
  await remove("placements", placementId);
}

/**
 * Move via a surface: the owning App decides what a move means when it
 * implements the hook (a task changes its day); otherwise Core pins it with a
 * Placement. `to === null` sends the item back to the pool / natural day.
 */
export async function moveSurfaceItem(
  item: Pick<SurfaceItem, "appId" | "itemId" | "placementId">,
  to: DateStr | null,
): Promise<void> {
  const provider = schedulableProviders().find((p) => p.appId === item.appId);
  if (!provider) throw new Error(`No Schedulable provider for app ${item.appId}`);
  if (provider.move) {
    await provider.move(item.itemId, to);
    if (item.placementId) await unplaceItem(item.placementId);
    return;
  }
  if (to === null) {
    if (item.placementId) await unplaceItem(item.placementId);
    return;
  }
  await placeItem(item.appId, item.itemId, to);
}

/** Whether an App owns move semantics (and so its items can go back to the pool). */
export function canUnplace(appId: string): boolean {
  return !!schedulableProviders().find((p) => p.appId === appId)?.move;
}

/** Complete via a surface: delegate to the owning App, then clear any pin. */
export async function completeSurfaceItem(
  item: Pick<SurfaceItem, "appId" | "itemId" | "placementId">,
  on?: DateStr,
): Promise<void> {
  const provider = schedulableProviders().find((p) => p.appId === item.appId);
  if (!provider) throw new Error(`No Schedulable provider for app ${item.appId}`);
  await provider.complete(item.itemId, on ?? todayStr());
  if (item.placementId) await unplaceItem(item.placementId);
}
