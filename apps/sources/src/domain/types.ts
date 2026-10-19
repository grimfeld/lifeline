import type { Document, SyncedRecord } from "@lifeline/core";

/**
 * A Source (CONTEXT.md, ADR 0016/0017): something outside Lifeline shown
 * inside it. One Document type holds every kind; `kind` discriminates.
 * The Source's name is the Document `title`.
 */
export type SourceKind = "embed" | "feed" | "ical" | "value";

export interface SourceBase extends Document {
  kind: SourceKind;
  /** Absolute http(s) URL (see normalizeEmbedUrl). */
  url: string;
  /** Refetch / reload period in minutes; null = never (Embed) / kind default (others). */
  refreshMinutes: number | null;
  /** Extra request headers (API keys). Stored on the record — the user's own PocketBase (ADR 0017). */
  headers?: Record<string, string>;
}

/** A web page shown as-is in a frame. */
export interface Embed extends SourceBase {
  kind: "embed";
}

/** An RSS/Atom feed listed as latest items; remembers only "seen up to". */
export interface Feed extends SourceBase {
  kind: "feed";
  /** ISO instant: items published after this are "new". */
  seenUpTo?: string | null;
}

/** An iCal URL whose events are read-only Timed items in this colour. */
export interface CalendarSub extends SourceBase {
  kind: "ical";
  /** One of the 8 chart colour slots ("blue", "orange", …). */
  color: string;
}

/** A polled URL from which one value is read. */
export interface LiveValue extends SourceBase {
  kind: "value";
  /** How to read the value: a dot/bracket path into JSON, or a regex with one capture group. */
  mode: "json" | "regex";
  path: string;
  unit?: string;
  prefix?: string;
  /** Decimals when the value is numeric; null = as-is. */
  decimals: number | null;
}

export type Source = Embed | Feed | CalendarSub | LiveValue;

/**
 * Document type id of a Window (CONTEXT.md "Window"): was `source` until the
 * word went to the hub of Notes and Quotes (ADR 0070). The code keeps its
 * Source names; the App, its ids and its Cards are the same.
 */
export const SOURCE_TYPE = "window";
/** @deprecated use SOURCE_TYPE */
export const SOURCES = SOURCE_TYPE;
/** Local-only (never synced) cache of each Source's last fetched body. */
export const SOURCE_CACHE = "_source_cache";

export interface SourceCacheEntry extends SyncedRecord {
  /** = source id */
  id: string;
  fetchedAt: string;
  ok: boolean;
  status: number;
  contentType: string;
  body: string;
  error?: string;
}

export const DEFAULT_REFRESH: Record<SourceKind, number | null> = { embed: null, feed: 30, ical: 60, value: 10 };

export const COLOR_SLOTS = ["blue", "orange", "aqua", "yellow", "magenta", "green", "violet", "red"] as const;
export type ColorSlot = (typeof COLOR_SLOTS)[number];
export const colorVar = (slot: string) => `var(--chart-${COLOR_SLOTS.includes(slot as ColorSlot) ? slot : "red"})`;
