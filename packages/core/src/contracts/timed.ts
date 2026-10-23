import { useMemo } from "react";
import { addDays, diffDays, formatHuman, weekdayOf, type DateStr } from "../dates";
import { appById, timedProviders } from "../registry";
import { matchesTagFilter, type TagFilter } from "../tags";
import { useTagFilter } from "./tagfilter";
import { inSurfaceScope, useSurfaceScope } from "./scope";
import { useStructuralMemo } from "../stable";

/** "HH:MM" local wall-clock time. */
export type TimeStr = string;

/**
 * When a timed thing happens, whole: from a start (day + time) to an end
 * (day + time), on any day (ADR 0090). `endDate` is the start's own day for
 * one that ends the same day.
 */
export interface TimedSpan {
  date: DateStr;
  start: TimeStr;
  endDate: DateStr;
  end: TimeStr;
}

/**
 * When a timed item is rescheduled to (the Timed contract's `reschedule`):
 * a start day and time to an end day and time. A null start makes it all
 * day; then `endDate` is its last day, and leaving it out keeps how many
 * days it covers. A timed one with no end day ends on its start day.
 */
export interface TimedWhen {
  date: DateStr;
  start: TimeStr | null;
  endDate?: DateStr;
  end: TimeStr | null;
}

/** A moment: a day and a wall-clock time. */
export interface Moment {
  date: DateStr;
  time: TimeStr;
}

/** Minutes in a day. */
export const DAY_MIN = 24 * 60;

/** A new timed item made on the hours (an Event added there, an all-day one lifted onto them) lasts an hour. */
export const NEW_TIMED_MIN = 60;

/** Minutes past midnight of "HH:MM" ("24:00" is the day's end); null for text that is no time. */
export function clockMinutes(t: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const [h, min] = [Number(m[1]), Number(m[2])];
  return min < 60 && (h < 24 || (h === 24 && min === 0)) ? h * 60 + min : null;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "HH:MM" for minutes past midnight, wrapping round the day. */
export function clockOf(minutes: number): TimeStr {
  const m = ((minutes % DAY_MIN) + DAY_MIN) % DAY_MIN;
  return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
}

/** Minutes from one moment to another (negative when the second is earlier); null when either time is no time. */
function minutesFrom(from: Moment, to: Moment): number | null {
  const [a, b] = [clockMinutes(from.time), clockMinutes(to.time)];
  const days = diffDays(from.date, to.date);
  if (a === null || b === null || !Number.isFinite(days)) return null;
  return days * DAY_MIN + b - a;
}

/** A span's length: minutes from its start moment to its end moment (negative for an end before the start); null when a time or day is no such thing. */
export function spanLength(span: TimedSpan): number | null {
  return minutesFrom({ date: span.date, time: span.start }, { date: span.endDate, time: span.end });
}

/**
 * A moment `minutes` after (or before) a day's time, normalised onto its own
 * day: Mon "23:30" + 60 is Tue "00:30", and Mon "24:00" is Tue "00:00".
 */
export function momentAfter(date: DateStr, time: TimeStr, minutes: number): Moment {
  const total = (clockMinutes(time) ?? 0) + minutes;
  const days = Math.floor(total / DAY_MIN);
  return { date: days ? addDays(date, days) : date, time: clockOf(total - days * DAY_MIN) };
}

/** The last day a timed span covers: its end day, or the day before when it ends at 00:00 — it only reaches midnight (ADR 0090). */
export function lastDayCovered(span: Pick<TimedSpan, "date" | "endDate" | "end">): DateStr {
  return span.end === "00:00" && span.endDate > span.date ? addDays(span.endDate, -1) : span.endDate;
}

/** The one span rule's refusal (ADR 0090), worded once for every form, Command and tool; null for a valid span. */
export function spanProblem(span: TimedSpan): string | null {
  return spanIsValid(span) ? null : "End must be after start";
}

/** Why a reschedule is refused, in words; null when it may be written. The span rule (ADR 0090) for a timed one. */
export function whenProblem(when: TimedWhen): string | null {
  if (!when.start) return when.end ? "An end time needs a start time" : when.endDate && when.endDate < when.date ? "Last day is before the first" : null;
  return when.end ? spanProblem({ date: when.date, start: when.start, endDate: when.endDate ?? when.date, end: when.end }) : null;
}

/**
 * The one rule for a span (ADR 0090): its end moment is strictly after its
 * start moment. An end at an earlier time on a later day is fine; an end equal
 * to the start is not. The Event form, its Peek, the add-event Command and the
 * MCP tools all ask this.
 */
export function spanIsValid(span: TimedSpan): boolean {
  const length = spanLength(span);
  return length !== null && length > 0;
}

/** A piece's whole span, or the piece's own hours where its provider reports none (an end-less item is a moment). */
function wholeOf(piece: Pick<TimedItem, "date" | "start" | "end" | "span">): TimedSpan {
  return piece.span ?? { date: piece.date, start: piece.start ?? "00:00", endDate: piece.date, end: piece.end ?? piece.start ?? "00:00" };
}

/**
 * Where a timed item lands when one of its pieces is dropped at a day and
 * time (ADR 0090): the whole span moves by the drop offset, keeping its
 * length, whichever piece was dragged. An item with no end (its piece's
 * `end` is null) stays end-less.
 */
export function spanMovedTo(piece: Pick<TimedItem, "date" | "start" | "end" | "span">, date: DateStr, start: TimeStr): Omit<TimedSpan, "end"> & { end: TimeStr | null } {
  const whole = wholeOf(piece);
  const offset = minutesFrom({ date: piece.date, time: piece.start ?? "00:00" }, { date, time: start }) ?? 0;
  const s = momentAfter(whole.date, whole.start, offset);
  const e = momentAfter(whole.endDate, whole.end, offset);
  return { date: s.date, start: s.time, endDate: e.date, end: piece.end === null ? null : e.time };
}

/** The span a timed item gets when its last piece is resized to end at a time on that piece's day; midnight is 00:00 the next day. */
export function spanEndingAt(piece: Pick<TimedItem, "date" | "start" | "end" | "span">, end: TimeStr): TimedSpan {
  const e = momentAfter(piece.date, end, 0);
  return { ...wholeOf(piece), endDate: e.date, end: e.time };
}

/** The day an End falls on by rolling alone (ADR 0090): the Start's own day, or the next when the End is earlier than the Start. */
function rolledEndDate(date: DateStr, start: TimeStr, end: TimeStr): DateStr {
  const [s, e] = [clockMinutes(start), clockMinutes(end)];
  return s !== null && e !== null && e < s ? addDays(date, 1) : date;
}

/**
 * A span given a new End time (ADR 0090): an End earlier than the Start rolls
 * to the next day, and back when it is after the Start again. An end day that
 * rolling would not give (picked by hand, or a span running for days) is kept.
 */
export function spanWithEnd(span: TimedSpan, end: TimeStr): TimedSpan {
  const rolled = span.endDate === rolledEndDate(span.date, span.start, span.end);
  return { ...span, end, endDate: rolled ? rolledEndDate(span.date, span.start, end) : span.endDate };
}

/** The day a timed item starts on when one of its pieces is dropped on `to`, for views that move by the day (Month). */
export function startDayMovedTo(piece: Pick<TimedItem, "date" | "span">, to: DateStr): DateStr {
  return piece.span ? addDays(piece.span.date, diffDays(piece.date, to)) : to;
}

/**
 * The span that starts at `start` on `date` and lasts `minutes`: into the
 * next day (or later) when it runs past midnight, and ending at 00:00 there
 * rather than "24:00" (ADR 0090). A start that is no time is kept as given.
 */
export function spanLasting(date: DateStr, start: TimeStr, minutes: number): TimedSpan {
  if (clockMinutes(start) === null) return { date, start, endDate: date, end: start };
  const e = momentAfter(date, start, Math.max(0, Math.round(minutes)));
  return { date, start, endDate: e.date, end: e.time };
}

/**
 * Minutes from a start time to an end time, an end earlier than the start
 * being the next day's (ADR 0090): "22:00" to "06:00" is 8h. 0 for an end
 * equal to the start (no span may have it); null when either is no time.
 */
export function minutesUntil(start: TimeStr, end: TimeStr): number | null {
  const [s, e] = [clockMinutes(start), clockMinutes(end)];
  if (s === null || e === null) return null;
  return (((e - s) % DAY_MIN) + DAY_MIN) % DAY_MIN;
}

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
  /** Day it appears on. Multi-day items report one TimedItem per day: a piece of the whole. */
  date: DateStr;
  /** null = all day. A piece's own hours: "00:00" where it carries on from the day before, "24:00" where it carries on into the next. */
  start: TimeStr | null;
  end: TimeStr | null;
  /**
   * A timed item's whole span (ADR 0090), on each of its pieces: where it
   * really starts and ends, so a view can label a cut edge ("↓ Tue 06:00")
   * and act on the whole item from any piece. Absent where the provider
   * reports no span (an all-day item, or an App that keeps to one day).
   */
  span?: TimedSpan;
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
  /**
   * Optional delegate of "the user dragged/resized this on the Schedule" (ADR 0015): when it now happens,
   * whole (ADR 0090). Callers check the span with `spanIsValid` first (`rescheduleTimedItem` does).
   */
  reschedule?(itemId: string, when: TimedWhen): Promise<void>;
  /**
   * Optional delegate of "the user clicked an empty slot": create a timed item
   * there, from a start to an end on `endDate` — the start's own day, or a
   * later one for an item that runs past midnight (ADR 0090). null start = all day.
   */
  create?(input: { title: string; date: DateStr; start: TimeStr | null; endDate: DateStr; end: TimeStr | null }): Promise<void>;
  /**
   * The Intake (ADR 0050, its `appId/id` key) whose dialog is the full form
   * for what `create` makes: the Schedule's quick add opens it, prefilled
   * with what is typed so far, from "More…".
   */
  createIntake?: string;
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
    items: p.useItems(range),
  }));
  const scope = useSurfaceScope();
  // Rebuilt only when an input moved: one dependency per provider, whose number is fixed (ADR 0003).
  const out = useMemo(() => {
    const rows: SurfaceTimedItem[] = [];
    for (const { provider, items } of perProvider) {
      const color = appById(provider.appId)?.color;
      const scoped = inSurfaceScope(scope, provider.appId);
      // Background bands (Time blockers) are the shape of the hours, not items,
      // so a Module's embedded Schedule keeps them whatever its scope (ADR 0057).
      for (const item of items) {
        if (item.background || (scoped && matchesTagFilter(item.tags, filter))) rows.push({ ...item, color: item.color ?? color });
      }
    }
    return rows.sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? "").localeCompare(b.start ?? "") || a.title.localeCompare(b.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...perProvider.map((p) => p.items), scope, filter]);
  // Stable while nothing changed, so the surfaces' memos can hit.
  return useStructuralMemo(out);
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

/** Reschedule a timed item through its App, refusing a span that isn't valid (ADR 0090). */
export async function rescheduleTimedItem(item: Pick<TimedItem, "appId" | "itemId">, when: TimedWhen): Promise<void> {
  const provider = timedProviders().find((p) => p.appId === item.appId);
  if (!provider?.reschedule) throw new Error(`${appById(item.appId)?.title ?? item.appId} items can't be rescheduled`);
  const problem = whenProblem(when);
  if (problem) throw new Error(problem);
  await provider.reschedule(item.itemId, when);
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

/**
 * "09:00" → "9:00 AM" style per locale; all-day → "". Text that is no time
 * (a bad synced or typed value) is "" too: `Intl.DateTimeFormat#format` throws
 * on an invalid Date, and one bad item must not blank a whole screen.
 */
export function formatTime(t: TimeStr | null): string {
  const hm = t ? /^(\d{1,2}):(\d{2})/.exec(t) : null;
  if (!hm) return "";
  timeFormat ??= new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
  return timeFormat.format(new Date(Date.UTC(2000, 0, 1, Number(hm[1]), Number(hm[2]))));
}

/** Short weekday names, indexed by Core weekday (0 = Sunday). */
export const WEEKDAY_NAMES: readonly string[] = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Where a span ends, as read on `date`: "06:00", or "Tue 06:00" when it ends on another day. */
export function endReadOn(span: Pick<TimedSpan, "endDate" | "end">, date: DateStr): string {
  const endDay = span.endDate !== date ? `${WEEKDAY_NAMES[weekdayOf(span.endDate)]} ` : "";
  return `${endDay}${formatTime(span.end)}`;
}

/** "22:00 – 23:00", or "22:00 – Tue 06:00" when the span ends another day (ADR 0090). */
export function describeSpan(span: TimedSpan): string {
  return `${formatTime(span.start)} – ${endReadOn(span, span.date)}`;
}

/**
 * The readout beside an End, ahead of its length: "until 18:00", or "until
 * Tue, Aug 25 06:00" style when it ends on another day. The Event form, the
 * Schedule's quick add and the Hours editor show it.
 */
export function describeEnd(span: Pick<TimedSpan, "date" | "endDate" | "end">): string {
  return `until ${span.endDate !== span.date ? `${formatHuman(span.endDate)} ` : ""}${formatTime(span.end)}`;
}

/** Whether a span runs past its start day: an end at 00:00 the next day only reaches midnight. */
function crossesDays(span: TimedSpan): boolean {
  return lastDayCovered(span) > span.date;
}

/** A moment of a span as a cut edge names it: "Tue 06:00". */
const momentOf = (date: DateStr, time: TimeStr) => `${WEEKDAY_NAMES[weekdayOf(date)]} ${formatTime(time)}`;

/**
 * The cut edges of a piece (ADR 0090), labelled with where its span carries
 * on: `before` ("↑ from Mon 22:00") where it began on an earlier day, `after`
 * ("↓ Tue 06:00") where it runs into the next. null for an edge that is the
 * span's own.
 */
export function cutEdges(piece: Pick<TimedItem, "date" | "span">): { before: string | null; after: string | null } {
  const span = piece.span;
  if (!span) return { before: null, after: null };
  const lastDay = lastDayCovered(span);
  return {
    before: piece.date > span.date ? `↑ from ${momentOf(span.date, span.start)}` : null,
    after: piece.date < lastDay ? `↓ ${momentOf(span.endDate, span.end)}` : null,
  };
}

/**
 * How a day-granular view leads a piece of a span that runs across days:
 * its first day reads the whole span ("22:00 – Tue 06:00"), a later day where
 * it ends ("→ 06:00", or "→ Wed 17:00" before its last day). null for an
 * item on one day — the view leads it its usual way.
 */
export function pieceLead(piece: Pick<TimedItem, "date" | "span">): string | null {
  const span = piece.span;
  if (!span || !crossesDays(span)) return null;
  if (piece.date <= span.date) return describeSpan(span);
  return `→ ${endReadOn(span, piece.date)}`;
}
