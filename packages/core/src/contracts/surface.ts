import { useLiveQuery } from "dexie-react-hooks";
import { db, type Placement } from "../data/db";
import { newId } from "../ids";
import { put, remove } from "../data/repo";
import { appById, schedulableProviders } from "../registry";
import { todayStr, type DateStr } from "../dates";
import type { SchedulableItem } from "./schedulable";

/** A Schedulable item resolved for display: placement pin > natural date; overdue rolled per owning App's policy. */
export interface SurfaceItem extends SchedulableItem {
  /** Day the surface should draw it on. */
  displayDate: DateStr;
  /** Set when a Placement pin, not the natural date, decided displayDate. */
  placementId?: string;
  color?: string;
}

/**
 * The read side of the Schedulable Contract, shared by every time surface
 * (month grid, week grid, Today feed). Collects items from all providers,
 * applies Placement pins, and rolls overdue items forward when the owning
 * App says so.
 */
export function useSurfaceItems(range: { start: DateStr; end: DateStr }): SurfaceItem[] {
  const providers = schedulableProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  const perProvider = providers.map((p) => ({
    provider: p,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    items: p.useItems(range),
  }));
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
      const pin = byItem.get(item.key);
      let displayDate = pin?.date ?? item.date;
      if (displayDate === null) continue; // unplaced pool item — not on a surface
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

/** Complete via a surface: delegate to the owning App, then clear any pin. */
export async function completeSurfaceItem(item: SurfaceItem, on?: DateStr): Promise<void> {
  const provider = schedulableProviders().find((p) => p.appId === item.appId);
  if (!provider) throw new Error(`No Schedulable provider for app ${item.appId}`);
  await provider.complete(item.itemId, on ?? todayStr());
  if (item.placementId) await unplaceItem(item.placementId);
}
