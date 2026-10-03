import { useLiveQuery } from "dexie-react-hooks";
import { db, type Placement } from "../data/db";
import { newId } from "../ids";
import { put, remove } from "../data/repo";
import { appById, schedulableProviders, timedProviders } from "../registry";
import { addDays, nowClock, todayStr, type DateStr } from "../dates";
import { freeStretch, planPush, PUSH_HORIZON_DAYS, type TakenSpan } from "./push";
import type { SchedulableItem, SchedulableProvider } from "./schedulable";
import { matchesTagFilter, type TagFilter } from "../tags";
import { useTagFilter } from "./tagfilter";
import { inSurfaceScope, useSurfaceScope } from "./scope";
import { useStructuralMemo } from "../stable";

/**
 * A Schedulable item resolved for display. One item yields one row on its
 * own day (a day pin or its natural date, overdue rolled per the owning
 * App's policy) plus one row per Time block (ADR 0028) — a block row has
 * `start` set and never moves the item's own day.
 */
export interface SurfaceItem extends SchedulableItem {
  /** Day the surface should draw it on. */
  displayDate: DateStr;
  /** The Placement behind this row: a Time block, or the day-only pin of an App that owns no moves. */
  placementId?: string;
  /** Time block (ADR 0015): "HH:MM" when this row is a block; null on the item's own row. */
  start?: string | null;
  end?: string | null;
  color?: string;
  /** On the item's own row: how many of its Time blocks still lie ahead (ADR 0028) — chips grey while > 0. */
  blocksAhead?: number;
}

/** An unplaced Schedulable item (natural date null): lives in the pool, not on a day. */
export interface PoolItem extends SchedulableItem {
  color?: string;
  /** Time blocks still ahead (ADR 0028): a pool chip stays a source and greys while > 0. */
  blocksAhead?: number;
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

function usePlacements(): Placement[] {
  return useLiveQuery(() => db().collection<Placement>("placements").where("deleted").equals(0).toArray(), [], [] as Placement[]);
}

function isBlock(pl: Placement): boolean {
  return !!pl.start;
}

/** A block still lies ahead while it has not ended yet. */
function blockAhead(pl: Placement, today: DateStr, now: string): boolean {
  if (pl.date > today) return true;
  if (pl.date < today) return false;
  return (pl.end ?? pl.start ?? "00:00") > now;
}

export interface ResolveOptions {
  /** The App implements `move`: its day is its own, so Core day pins are ignored for it. */
  ownsMoves: boolean;
  overduePolicy: SchedulableProvider["overduePolicy"];
  today: DateStr;
  /** "HH:MM" wall clock, for "still ahead". */
  now: string;
}

/**
 * The pure heart of the read side (ADR 0028): one item's rows from its
 * Placements. The own-day row carries `blocksAhead`; each Time block is a row
 * of its own on the block's day. Blocks of a completed item that fall after
 * the completion day are not shown (they are also swept on completion).
 * Blocks never roll forward — the own-day row does, per the App's policy.
 */
export function resolveItemRows(item: SchedulableItem, placements: Placement[], opts: ResolveOptions): Omit<SurfaceItem, "color">[] {
  const blocks = placements.filter(isBlock);
  const dayPin = opts.ownsMoves ? undefined : placements.filter((pl) => !isBlock(pl)).at(-1);
  const out: Omit<SurfaceItem, "color">[] = [];

  const ahead = item.completedOn ? 0 : blocks.filter((b) => blockAhead(b, opts.today, opts.now)).length;
  let ownDay = dayPin?.date ?? item.date;
  if (ownDay !== null) {
    if (!item.completedOn && ownDay < opts.today && opts.overduePolicy === "roll-forward" && !dayPin) ownDay = opts.today;
    out.push({ ...item, displayDate: ownDay, placementId: dayPin?.id, start: null, end: null, blocksAhead: ahead });
  }
  for (const b of blocks) {
    if (item.completedOn && b.date > item.completedOn) continue;
    out.push({ ...item, displayDate: b.date, placementId: b.id, start: b.start ?? null, end: b.end ?? null });
  }
  return out;
}

/** True when the item belongs in the unplaced pool: no day of its own, no day pin, not done. */
export function isPoolItem(item: SchedulableItem, placements: Placement[], ownsMoves: boolean): boolean {
  if (item.date !== null || item.completedOn) return false;
  if (ownsMoves) return true;
  return !placements.some((pl) => !isBlock(pl));
}

function groupByItem(placements: Placement[]): Map<string, Placement[]> {
  const byItem = new Map<string, Placement[]>();
  for (const pl of placements) {
    const key = `${pl.appId}/${pl.itemId}`;
    const list = byItem.get(key);
    if (list) list.push(pl);
    else byItem.set(key, [pl]);
  }
  return byItem;
}

/**
 * The read side of the Schedulable Contract, shared by every time surface.
 * Collects items from all providers, applies Placements, and rolls overdue
 * items forward when the owning App says so. Day-granular surfaces keep the
 * rows without `start`; hour-scaled ones and the Today feed draw the block
 * rows too (ADR 0028).
 */
export function useSurfaceItems(range: { start: DateStr; end: DateStr }, opts?: { tags?: TagFilter }): SurfaceItem[] {
  const ambient = useTagFilter();
  const filter = opts?.tags ?? ambient;
  const scope = useSurfaceScope();
  const perProvider = useProviderItems(range);
  const placements = usePlacements();

  const today = todayStr();
  const now = nowClock();
  const byItem = groupByItem(placements);

  const out: SurfaceItem[] = [];
  for (const { provider, items } of perProvider) {
    if (!inSurfaceScope(scope, provider.appId)) continue;
    const color = appById(provider.appId)?.color;
    const resolve: ResolveOptions = { ownsMoves: !!provider.move, overduePolicy: provider.overduePolicy, today, now };
    for (const item of items) {
      if (!matchesTagFilter(item.tags, filter)) continue;
      for (const row of resolveItemRows(item, byItem.get(item.key) ?? [], resolve)) out.push({ ...row, color });
    }
  }
  // Stable while nothing changed, so the surfaces' memos can hit.
  return useStructuralMemo(out.filter((i) => i.displayDate >= range.start && i.displayDate <= range.end));
}

/**
 * The same rows, and the pool, read once outside React — what an agent's
 * agenda shows (ADR 0062). Only providers with `itemsIn` take part; no Tag
 * filter or Surface scope applies, since there is no Surface.
 */
export async function surfaceItemsIn(range: { start: DateStr; end: DateStr }): Promise<{ items: SurfaceItem[]; pool: PoolItem[] }> {
  const placements = await db().collection<Placement>("placements").where("deleted").equals(0).toArray();
  const today = todayStr();
  const now = nowClock();
  const byItem = groupByItem(placements);
  const items: SurfaceItem[] = [];
  const pool: PoolItem[] = [];
  for (const provider of schedulableProviders()) {
    if (!provider.itemsIn) continue;
    const color = appById(provider.appId)?.color;
    const resolve: ResolveOptions = { ownsMoves: !!provider.move, overduePolicy: provider.overduePolicy, today, now };
    for (const item of await provider.itemsIn(range)) {
      const own = byItem.get(item.key) ?? [];
      if (isPoolItem(item, own, !!provider.move)) pool.push({ ...item, color });
      for (const row of resolveItemRows(item, own, resolve)) items.push({ ...row, color });
    }
  }
  return { items: items.filter((i) => i.displayDate >= range.start && i.displayDate <= range.end), pool };
}

/**
 * Items no App has put on a day yet (natural date null, no day pin) — the
 * "unplaced" column of a planning surface. Time blocks do not take an item
 * out of the pool (ADR 0028): the chip stays, greyed while a block lies
 * ahead. Providers report pool items regardless of the queried range, so any
 * range works.
 */
export function usePoolItems(opts?: { tags?: TagFilter }): PoolItem[] {
  const ambient = useTagFilter();
  const filter = opts?.tags ?? ambient;
  const today = todayStr();
  const now = nowClock();
  const scope = useSurfaceScope();
  const perProvider = useProviderItems({ start: today, end: today });
  const placements = usePlacements();
  const byItem = groupByItem(placements);
  const out: PoolItem[] = [];
  for (const { provider, items } of perProvider) {
    if (!inSurfaceScope(scope, provider.appId)) continue;
    const color = appById(provider.appId)?.color;
    for (const item of items) {
      const own = byItem.get(item.key) ?? [];
      if (!isPoolItem(item, own, !!provider.move)) continue;
      if (!matchesTagFilter(item.tags, filter)) continue;
      const blocksAhead = own.filter((pl) => isBlock(pl) && blockAhead(pl, today, now)).length;
      out.push({ ...item, color, blocksAhead });
    }
  }
  return useStructuralMemo(out);
}

/** Pin an item to a day without a time (the Core fallback for Apps that own no moves): one such pin per item. */
export async function placeItem(appId: string, itemId: string, date: DateStr): Promise<void> {
  const existing = (await db().collection<Placement>("placements").where("[appId+itemId]").equals([appId, itemId]).toArray()).find(
    (pl) => !pl.deleted && !isBlock(pl),
  );
  await put<Placement>("placements", { id: existing?.id ?? newId(), appId, itemId, date, start: null, end: null });
}

/** A new Time block for an item (ADR 0028): always another Placement, never a replacement. */
export async function addTimeBlock(appId: string, itemId: string, date: DateStr, time: { start: string; end: string | null }): Promise<string> {
  const id = newId();
  await put<Placement>("placements", { id, appId, itemId, date, start: time.start, end: time.end });
  return id;
}

/** Retime or move one Time block; the item is untouched. */
export async function moveTimeBlock(placementId: string, date: DateStr, time: { start: string; end: string | null }): Promise<void> {
  const pl = await db().collection<Placement>("placements").get(placementId);
  if (!pl) throw new Error("That block is gone");
  await put<Placement>("placements", { ...pl, date, start: time.start, end: time.end });
}

/**
 * Plan a chip or a block into the Schedule (ADR 0015, 0028). With a time: a
 * chip gets a new Time block there, a block moves there — and the item's own
 * day never changes. With `time === null` (dropped on a day's untimed
 * strip): the block, if any, is gone, and the item takes that day — through
 * the App's `move` when it owns moves, else through a Core day pin.
 */
export async function scheduleSurfaceItem(
  item: Pick<SurfaceItem, "appId" | "itemId" | "placementId" | "start" | "displayDate"> & { date?: DateStr | null },
  date: DateStr,
  time: { start: string; end: string | null } | null,
): Promise<void> {
  const provider = schedulableProviders().find((p) => p.appId === item.appId);
  if (!provider) throw new Error(`No Schedulable provider for app ${item.appId}`);
  if (time) {
    if (item.placementId && item.start) await moveTimeBlock(item.placementId, date, time);
    else await addTimeBlock(item.appId, item.itemId, date, time);
    return;
  }
  if (item.placementId && item.start) await unplaceItem(item.placementId);
  if (provider.move) {
    if (date !== (item.date ?? null)) await provider.move(item.itemId, date);
    return;
  }
  if (date !== item.date) await placeItem(item.appId, item.itemId, date);
  else if (item.placementId && !item.start) await unplaceItem(item.placementId);
}

export async function unplaceItem(placementId: string): Promise<void> {
  await remove("placements", placementId);
}

/** Where a Time block sits now — what an Undo puts it back to. */
export async function timeBlockAt(placementId: string): Promise<{ date: DateStr; start: string; end: string | null } | undefined> {
  const pl = await db().collection<Placement>("placements").get(placementId);
  if (!pl || pl.deleted || !pl.start) return undefined;
  return { date: pl.date, start: pl.start, end: pl.end ?? null };
}

/**
 * Remove one Time block, the item untouched (ADR 0028); resolves to its Undo,
 * which brings the same Placement back (ADR 0056).
 */
export async function removeTimeBlock(placementId: string): Promise<() => Promise<void>> {
  const pl = await db().collection<Placement>("placements").get(placementId);
  if (!pl || pl.deleted) throw new Error("That block is gone");
  await unplaceItem(placementId);
  return () => put<Placement>("placements", { ...pl, deleted: 0 });
}

/** Where the owning App edits an item in full; undefined when it offers no route. */
export function schedulableHref(item: Pick<SchedulableItem, "appId" | "itemId">): string | undefined {
  return schedulableProviders().find((p) => p.appId === item.appId)?.href?.(item.itemId);
}

/**
 * Move via a surface: the owning App decides what a move means when it
 * implements the hook (a task changes its day); otherwise Core pins it with a
 * day Placement. `to === null` sends the item back to the pool / natural
 * day. A Time block row moved this way is simply removed (ADR 0028) — the
 * item keeps its own day.
 */
export async function moveSurfaceItem(
  item: Pick<SurfaceItem, "appId" | "itemId" | "placementId" | "start">,
  to: DateStr | null,
): Promise<void> {
  const provider = schedulableProviders().find((p) => p.appId === item.appId);
  if (!provider) throw new Error(`No Schedulable provider for app ${item.appId}`);
  if (item.placementId && item.start) {
    await unplaceItem(item.placementId);
    return;
  }
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

/** Every live Placement of one item. */
async function placementsOf(appId: string, itemId: string): Promise<Placement[]> {
  return (await db().collection<Placement>("placements").where("[appId+itemId]").equals([appId, itemId]).toArray()).filter((pl) => !pl.deleted);
}

/**
 * Complete via a surface: delegate to the owning App, then clear the day pin
 * and every Time block still ahead — the past ones stay as record (ADR 0028).
 */
export async function completeSurfaceItem(
  item: Pick<SurfaceItem, "appId" | "itemId">,
  on?: DateStr,
): Promise<void> {
  const provider = schedulableProviders().find((p) => p.appId === item.appId);
  if (!provider) throw new Error(`No Schedulable provider for app ${item.appId}`);
  await provider.complete(item.itemId, on ?? todayStr());
  const today = todayStr();
  const now = nowClock();
  for (const pl of await placementsOf(item.appId, item.itemId)) {
    if (!isBlock(pl) || blockAhead(pl, today, now)) await unplaceItem(pl.id);
  }
}

/**
 * Sweep an item's Placements when the App deletes the item (ADR 0028).
 * `itemId` may be a predicate for Apps whose item ids derive from one
 * record (a recurring Task's Occurrences).
 */
export async function removePlacementsOf(appId: string, itemId: string | ((itemId: string) => boolean)): Promise<void> {
  const rows = await db().collection<Placement>("placements").where("[appId+itemId]").between([appId, ""], [appId, "￿"]).toArray();
  const match = typeof itemId === "string" ? (id: string) => id === itemId : itemId;
  for (const pl of rows) if (!pl.deleted && match(pl.itemId)) await unplaceItem(pl.id);
}

/** Whether an App's items can be pushed (ADR 0054): it must take an Estimate. */
export function canPush(appId: string): boolean {
  return !!schedulableProviders().find((p) => p.appId === appId)?.setEstimate;
}

export interface PushResult {
  date: DateStr;
  start: string;
  end: string;
  /** An existing block was pushed (else a new one was made). */
  moved: boolean;
  /** Put things back as they were: remove the new block, or return the pushed one. */
  undo(): Promise<void>;
}

/** Hours already taken across [range]: every timed Event and blocker band Push can read, and every Time block but `exceptId`. */
async function takenHours(range: { start: DateStr; end: DateStr }, exceptId: string | undefined): Promise<TakenSpan[]> {
  const out: TakenSpan[] = [];
  for (const provider of timedProviders()) {
    if (!provider.itemsIn) continue;
    for (const item of await provider.itemsIn(range)) if (item.start) out.push({ date: item.date, start: item.start, end: item.end });
  }
  const placements = await db().collection<Placement>("placements").where("deleted").equals(0).toArray();
  for (const pl of placements) {
    if (!pl.start || pl.id === exceptId || pl.date < range.start || pl.date > range.end) continue;
    out.push({ date: pl.date, start: pl.start, end: pl.end ?? null });
  }
  return out;
}

/**
 * Push (ADR 0054): find the item time in the Schedule's hours. With no block
 * ahead, a new Time block of the Estimate goes into the first free stretch;
 * with one, the earliest block ahead moves later at its own length. An
 * `estimateMin` passed here is the answer to "how long?" and is kept by the
 * owning App first. Resolves null when nothing is free within the horizon —
 * nothing is written then.
 */
export async function pushSurfaceItem(
  item: Pick<SchedulableItem, "appId" | "itemId" | "date" | "estimateMin">,
  estimateMin?: number,
): Promise<PushResult | null> {
  const provider = schedulableProviders().find((p) => p.appId === item.appId);
  if (!provider?.setEstimate) throw new Error(`${appById(item.appId)?.title ?? item.appId} items can't be pushed`);
  const minutes = estimateMin ?? item.estimateMin;
  if (!minutes || minutes <= 0) throw new Error("Push needs an Estimate");
  if (estimateMin && estimateMin !== item.estimateMin) await provider.setEstimate(item.itemId, estimateMin);

  const blocks = (await placementsOf(item.appId, item.itemId)).filter(isBlock);
  const plan = planPush({
    itemDate: item.date,
    blocks: blocks.map((b) => ({ id: b.id, date: b.date, start: b.start!, end: b.end ?? null })),
    estimateMin: minutes,
    today: todayStr(),
    now: nowClock(),
  });
  const range = { start: plan.from.date, end: addDays(plan.from.date, PUSH_HORIZON_DAYS - 1) };
  const stretch = freeStretch(await takenHours(range, plan.blockId), plan.from, plan.minutes);
  if (!stretch) return null;

  const time = { start: stretch.start, end: stretch.end };
  const pushed = plan.blockId ? blocks.find((b) => b.id === plan.blockId) : undefined;
  if (pushed) {
    await moveTimeBlock(pushed.id, stretch.date, time);
    const back = { start: pushed.start!, end: pushed.end ?? null };
    return { ...stretch, moved: true, undo: () => moveTimeBlock(pushed.id, pushed.date, back) };
  }
  const id = await addTimeBlock(item.appId, item.itemId, stretch.date, time);
  return { ...stretch, moved: false, undo: () => unplaceItem(id) };
}
