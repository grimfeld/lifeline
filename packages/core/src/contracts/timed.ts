import type { DateStr } from "../dates";
import { appById, timedProviders } from "../registry";

/** "HH:MM" local wall-clock time. */
export type TimeStr = string;

/**
 * An App entity that happens at a fixed time on a day: shown on time surfaces
 * but not work — nothing to complete. The Calendar App's Events are the
 * first implementation (CONTEXT.md).
 */
export interface TimedItem {
  /** `${appId}/${itemId}` — unique across Apps. */
  key: string;
  appId: string;
  itemId: string;
  title: string;
  subtitle?: string;
  /** Day it appears on. Multi-day items report one TimedItem per day. */
  date: DateStr;
  /** null = all day. */
  start: TimeStr | null;
  end: TimeStr | null;
}

export interface TimedProvider {
  appId: string;
  /** React hook. Live items whose day falls in [start, end]. */
  useItems(range: { start: DateStr; end: DateStr }): TimedItem[];
  /** Optional delegate of "the user dragged this to another day". */
  move?(itemId: string, to: DateStr): Promise<void>;
}

export interface SurfaceTimedItem extends TimedItem {
  color?: string;
}

/** Read side of the Timed contract: every provider's items in range, colored per App. */
export function useTimedItems(range: { start: DateStr; end: DateStr }): SurfaceTimedItem[] {
  const providers = timedProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  const perProvider = providers.map((p) => ({
    provider: p,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    items: p.useItems(range),
  }));
  const out: SurfaceTimedItem[] = [];
  for (const { provider, items } of perProvider) {
    const color = appById(provider.appId)?.color;
    for (const item of items) out.push({ ...item, color });
  }
  return out.sort((a, b) =>
    a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title),
  );
}

export function canMoveTimed(appId: string): boolean {
  return !!timedProviders().find((p) => p.appId === appId)?.move;
}

export async function moveTimedItem(item: Pick<TimedItem, "appId" | "itemId">, to: DateStr): Promise<void> {
  const provider = timedProviders().find((p) => p.appId === item.appId);
  if (!provider?.move) throw new Error(`${appById(item.appId)?.title ?? item.appId} items can't be moved`);
  await provider.move(item.itemId, to);
}

/** "09:00" → "9:00 AM" style per locale; all-day → "". */
export function formatTime(t: TimeStr | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return new Date(Date.UTC(2000, 0, 1, h, m)).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}
