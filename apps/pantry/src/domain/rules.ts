import type { Provision, Storage, StorageKind } from "./types";

/** Default "expiring soon" horizon; the Expiring soon Card can override per instance. */
export const DEFAULT_EXPIRY_WINDOW_DAYS = 7;

export const KIND_ORDER: Record<StorageKind, number> = { freezer: 0, fridge: 1, shelf: 2 };
export const KIND_LABELS: Record<StorageKind, string> = { freezer: "Freezer", fridge: "Fridge", shelf: "Shelf" };

/** Quantities are whole and never negative. */
export function clampQty(n: number): number {
  return Math.max(0, Math.round(Number.isFinite(n) ? n : 0));
}

/**
 * Running low (CONTEXT.md): under the Minimum, or out entirely — always a
 * derived reading, never a list you edit.
 */
export function isRunningLow(p: Pick<Provision, "quantity" | "minimum">): boolean {
  return p.quantity <= 0 || (p.minimum > 0 && p.quantity < p.minimum);
}

/** "YYYY-MM-DD" + n days, in UTC so no DST day ever doubles or vanishes. */
export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isExpired(p: Pick<Provision, "expires">, today: string): boolean {
  return !!p.expires && p.expires < today;
}

/** Within the window — the already-expired included; a hint unseen is a hint wasted. */
export function expiresSoon(p: Pick<Provision, "expires">, today: string, windowDays: number): boolean {
  return !!p.expires && p.expires <= addDays(today, windowDays);
}

const byTitle = (a: { title: string }, b: { title: string }) => a.title.localeCompare(b.title);

export function runningLow(list: Provision[]): Provision[] {
  return list.filter(isRunningLow).sort(byTitle);
}

export function expiring(list: Provision[], today: string, windowDays: number): Provision[] {
  return list.filter((p) => expiresSoon(p, today, windowDays)).sort((a, b) => a.expires.localeCompare(b.expires) || byTitle(a, b));
}

/** Freezers first, then fridges, then shelves — the walk through the kitchen. */
export function sortStorages(list: Storage[]): Storage[] {
  return [...list].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byTitle(a, b));
}

export function provisionsIn(list: Provision[], storageId: string): Provision[] {
  return list.filter((p) => p.storageId === storageId).sort(byTitle);
}

/** Provisions pointing at no existing Storage (deleted or never set). */
export function unplaced(list: Provision[], storages: Storage[]): Provision[] {
  const ids = new Set(storages.map((s) => s.id));
  return list.filter((p) => !ids.has(p.storageId)).sort(byTitle);
}

/** The Provision a quick add should restock: same Storage, same title (case-insensitive). */
export function matchByTitle(list: Provision[], storageId: string, name: string): Provision | undefined {
  const q = name.trim().toLowerCase();
  if (!q) return undefined;
  return list.find((p) => p.storageId === storageId && p.title.trim().toLowerCase() === q);
}
