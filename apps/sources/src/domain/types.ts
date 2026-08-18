import type { DateStr, SyncedRecord } from "@lifeline/core";

/**
 * A Source (CONTEXT.md, ADR 0016): something outside Lifeline shown inside
 * it. One collection holds every kind; `kind` discriminates. The first kind
 * is the Embed — a web page shown as-is in a frame.
 */
export type SourceKind = "embed";

export interface SourceBase extends SyncedRecord {
  kind: SourceKind;
  name: string;
  /** Normalised Tags (ADR 0014); undefined on old records — read with `?? []`. */
  tags?: string[];
  createdAt: DateStr;
}

export interface Embed extends SourceBase {
  kind: "embed";
  /** Absolute http(s) URL (see normalizeEmbedUrl). */
  url: string;
  /** Reload the frame every N minutes; null = never. */
  refreshMinutes: number | null;
}

export type Source = Embed;

export const SOURCES = "sources";
