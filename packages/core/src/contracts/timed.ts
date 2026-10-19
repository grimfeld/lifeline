import type { DateStr } from "../dates";
import { appById, timedProviders } from "../registry";
import { matchesTagFilter, type TagFilter } from "../tags";
import { useTagFilter } from "./tagfilter";
import { inSurfaceScope, useSurfaceScope } from "./scope";
import { useStructuralMemo } from "../stable";

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
  /** The entity's Tags (ADR 0014). */
  tags?: string[];
  /** Overrides the App colour on surfaces (a Calendar subscription's own colour, ADR 0017). */
  color?: string;
  /**
   * A recurring band of blocked time (a Time blocker, ADR 0027), not a
   * discrete thing: hour-scaled surfaces draw it behind everything else and
   * never move it, day-granular surfaces leave it out.
   */
  background?: boolean;
  /**
   * A background band that comes from a rule (a weekly Time blocker): never
   * dragged, since a drag would silently retime every week (ADR 0029). A
   * one-off band leaves this unset and moves through `reschedule`.
   */
  fixed?: boolean;
  /**
   * A day that matters with nothing happening on it — a Project's Deadline
   * (ADR 0061). Always all day, so it takes no hours; Surfaces draw it as a
   * flag rather than an Event, and red once its day has passed.
   */
  marker?: boolean;
}

/** Whether a marker's day has passed (ADR 0061): it stays there, red, and never rolls forward. */
export function isMissedMarker(item: Pick<TimedItem, "marker" | "date">, today: DateStr): boolean {
  return !!item.marker && item.date < today;
}

/**
 * A named shape for a new Timed item (an Event template, ADR 0027, or a
 * Blocker template, ADR 0029): what a planning surface offers for quick add.
 * The owning App keeps the definition and does the creating; the surface
 * only says when.
 */
export interface TimedTemplate {
  /** `${appId}/${id}` — unique across Apps. */
  key: string;
  appId: string;
  id: string;
  title: string;
  subtitle?: string;
  /** How long the created item lasts. null = all day. */
  durationMin: number | null;
  /** Where it wants to land when the surface has no slot of its own. null = all day. */
  defaultStart: TimeStr | null;
  tags?: string[];
  color?: string;
  /** Makes a background band (a one-off Time blocker), not a thing: the palette draws it hatched and needs a slot. */
  background?: boolean;
}

export interface TimedProvider {
  appId: string;
  /** React hook. Live items whose day falls in [start, end]. */
  useItems(range: { start: DateStr; end: DateStr }): TimedItem[];
  /**
   * The same items, read once outside React — what Push (ADR 0054) reads
   * for the hours already taken. A provider without it holds no hours as far
   * as Push can tell.
   */
  itemsIn?(range: { start: DateStr; end: DateStr }): Promise<TimedItem[]>;
  /** Optional delegate of "the user dragged this to another day". */
  move?(itemId: string, to: DateStr): Promise<void>;
  /** Optional delegate of "the user dragged/resized this on the Schedule" (ADR 0015): new day and time (null = all day). */
  reschedule?(itemId: string, date: DateStr, start: TimeStr | null, end: TimeStr | null): Promise<void>;
  /** Optional delegate of "the user clicked an empty slot": create a timed item there. */
  create?(input: { title: string; date: DateStr; start: TimeStr | null; end: TimeStr | null }): Promise<void>;
  /** React hook. Quick-add templates this App offers planning surfaces (ADR 0027). */
  useTemplates?(): TimedTemplate[];
  /** Optional delegate of "the user quick-added this template here" (null start = all day). */
  createFromTemplate?(templateId: string, date: DateStr, start: TimeStr | null): Promise<void>;
  /**
   * Optional delegate of "the user removed this from the hours" (ADR 0056).
   * Returns the Undo: the App puts back what it deleted, whole — Core never
   * learns the item's fields. An item the App will not remove here (a weekly
   * Time blocker, a rule) throws.
   */
  remove?(itemId: string): Promise<() => Promise<void>>;
  /** Optional delegate of "the user renamed this on the hours". */
  rename?(itemId: string, title: string): Promise<void>;
  /** Optional route that opens the item where its App edits it in full. */
  href?(itemId: string): string;
}

export interface SurfaceTimedItem extends TimedItem {
  color?: string;
}

/**
 * Read side of the Timed contract: every provider's items in range, colored
 * per App, narrowed by the ambient Tag filter (or an explicit one). Background
 * items (Time blocker bands, ADR 0027) are never filtered out: a band is the
 * hours around the content, not content.
 */
export function useTimedItems(range: { start: DateStr; end: DateStr }, opts?: { tags?: TagFilter }): SurfaceTimedItem[] {
  const ambient = useTagFilter();
  const filter = opts?.tags ?? ambient;
  const providers = timedProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  const perProvider = providers.map((p) => ({
    provider: p,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    items: p.useItems(range),
  }));
  const scope = useSurfaceScope();
  const out: SurfaceTimedItem[] = [];
  for (const { provider, items } of perProvider) {
    const color = appById(provider.appId)?.color;
    const scoped = inSurfaceScope(scope, provider.appId);
    // Background bands (Time blockers) are the shape of the hours, not items,
    // so a Module's embedded Schedule keeps them whatever its scope (ADR 0057).
    for (const item of items) {
      if (item.background || (scoped && matchesTagFilter(item.tags, filter))) out.push({ ...item, color: item.color ?? color });
    }
  }
  // Stable while nothing changed, so the surfaces' memos can hit.
  return useStructuralMemo(
    out.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title)),
  );
}

/**
 * Read side of the quick-add half of the Timed contract (ADR 0027): every
 * provider's Event templates, coloured per App. Providers that offer
 * templates but cannot create from them are skipped — a template you cannot
 * add is not a template.
 */
export function useTimedTemplates(): TimedTemplate[] {
  const providers = timedProviders();
  // Hook order is stable: the provider list is fixed at compile time (ADR 0003).
  const perProvider = providers.map((p) => ({
    provider: p,
    // eslint-disable-next-line react-hooks/rules-of-hooks
    templates: p.useTemplates && p.createFromTemplate ? p.useTemplates() : [],
  }));
  const out: TimedTemplate[] = [];
  for (const { provider, templates } of perProvider) {
    const color = appById(provider.appId)?.color;
    for (const t of templates) out.push({ ...t, color: t.color ?? color });
  }
  return out;
}

/** Add one Event template to a day and time (null start = all day). */
export async function createFromTimedTemplate(template: Pick<TimedTemplate, "appId" | "id">, date: DateStr, start: TimeStr | null): Promise<void> {
  const provider = timedProviders().find((p) => p.appId === template.appId);
  if (!provider?.createFromTemplate) throw new Error(`${appById(template.appId)?.title ?? template.appId} has no templates`);
  await provider.createFromTemplate(template.id, date, start);
}

export function canRescheduleTimed(appId: string): boolean {
  return !!timedProviders().find((p) => p.appId === appId)?.reschedule;
}

export async function rescheduleTimedItem(item: Pick<TimedItem, "appId" | "itemId">, date: DateStr, start: TimeStr | null, end: TimeStr | null): Promise<void> {
  const provider = timedProviders().find((p) => p.appId === item.appId);
  if (!provider?.reschedule) throw new Error(`${appById(item.appId)?.title ?? item.appId} items can't be rescheduled`);
  await provider.reschedule(item.itemId, date, start, end);
}

/** Providers that can create a timed item from the surface (the Calendar App). */
export function timedCreators(): TimedProvider[] {
  return timedProviders().filter((p) => !!p.create);
}

export function canMoveTimed(appId: string): boolean {
  return !!timedProviders().find((p) => p.appId === appId)?.move;
}

export async function moveTimedItem(item: Pick<TimedItem, "appId" | "itemId">, to: DateStr): Promise<void> {
  const provider = timedProviders().find((p) => p.appId === item.appId);
  if (!provider?.move) throw new Error(`${appById(item.appId)?.title ?? item.appId} items can't be moved`);
  await provider.move(item.itemId, to);
}

function providerOf(appId: string): TimedProvider | undefined {
  return timedProviders().find((p) => p.appId === appId);
}

export function canRemoveTimed(item: Pick<TimedItem, "appId" | "fixed">): boolean {
  return !item.fixed && !!providerOf(item.appId)?.remove;
}

/** Remove a Timed item through its App (ADR 0056); resolves to the App's Undo. */
export async function removeTimedItem(item: Pick<TimedItem, "appId" | "itemId">): Promise<() => Promise<void>> {
  const provider = providerOf(item.appId);
  if (!provider?.remove) throw new Error(`${appById(item.appId)?.title ?? item.appId} items can't be removed here`);
  return provider.remove(item.itemId);
}

export function canRenameTimed(item: Pick<TimedItem, "appId" | "background">): boolean {
  return !item.background && !!providerOf(item.appId)?.rename;
}

export async function renameTimedItem(item: Pick<TimedItem, "appId" | "itemId">, title: string): Promise<void> {
  const provider = providerOf(item.appId);
  if (!provider?.rename) throw new Error(`${appById(item.appId)?.title ?? item.appId} items can't be renamed here`);
  await provider.rename(item.itemId, title);
}

/** Where the owning App edits the item in full; undefined when it offers no route. */
export function timedHref(item: Pick<TimedItem, "appId" | "itemId">): string | undefined {
  return providerOf(item.appId)?.href?.(item.itemId);
}

/**
 * Made once: `toLocaleTimeString` with options builds a new formatter on every
 * call, and an hour grid formats dozens of times per render.
 */
let timeFormat: Intl.DateTimeFormat | undefined;

/** "09:00" → "9:00 AM" style per locale; all-day → "". */
export function formatTime(t: TimeStr | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  timeFormat ??= new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return timeFormat.format(new Date(Date.UTC(2000, 0, 1, h, m)));
}
