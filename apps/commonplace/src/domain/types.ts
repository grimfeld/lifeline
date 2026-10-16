import type { DateStr, Document } from "@lifeline/core";

/**
 * The Notes App's types (ADR 0070): the **Source** hub, the **Note** (my words
 * on a Source) and the **Quote** (a passage from one). The App's id stays
 * `commonplace` — Card and Command ids live in synced Screen layouts and agent
 * tool names (ADR 0024's precedent).
 */
export const SOURCE = "source";
export const NOTE = "note";
export const QUOTES = "quote";

/** The Role every Source plays (ADR 0069): the Source type is its home; works play it by construction. */
export const SOURCE_ROLE = "source";

export const SOURCES_FOLDER = "Sources";
export const NOTES_FOLDER = "Notes";
export const QUOTES_FOLDER = "Quotes";

/** The kinds of Source that are nobody else's — works keep their own types. */
export const SOURCE_KINDS = [
  { value: "article", label: "Article", plural: "Articles" },
  { value: "podcast", label: "Podcast", plural: "Podcasts" },
  { value: "episode", label: "Episode", plural: "Episodes" },
  { value: "video", label: "Video", plural: "Videos" },
  { value: "website", label: "Website", plural: "Websites" },
  { value: "paper", label: "Paper", plural: "Papers" },
  { value: "talk", label: "Talk", plural: "Talks" },
  { value: "other", label: "Other", plural: "Other" },
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number]["value"];

export const isSourceKind = (v: unknown): v is SourceKind => SOURCE_KINDS.some((k) => k.value === v);

/** A Source of the Notes App's own type: an article, a podcast, an episode… */
export interface OwnSource extends Document {
  type: typeof SOURCE;
  kind: SourceKind | "";
  url: string;
  author: string;
  publishedOn: DateStr | "";
  /** The Source it belongs to — a show for an episode, a magazine for an article — or "". */
  parent: string;
  aliases?: string[];
}

/** A Note (CONTEXT.md): my words on a Source, impossible without it. */
export interface Note extends Document {
  type: typeof NOTE;
  body: string;
  source: string;
  /** Page, chapter, timestamp — where in the Source. */
  locator: string;
  aliases?: string[];
}

/**
 * A Quote (CONTEXT.md): a passage taken from a Source — its body — with an
 * optional locator and comment, impossible without the Source it links to.
 * Absorbs the old Clipping.
 */
export interface Quote extends Document {
  type: typeof QUOTES;
  body: string;
  source: string;
  locator: string;
  comment: string;
  capturedOn: DateStr;
}

export const APP_ID = "commonplace";
export const SHELF_HREF = "/app/notes";
export const QUOTES_HREF = "/app/quotes";
export const sourceHref = (id: string) => `/app/notes/s/${id}`;
export const noteHref = (id: string) => `/app/notes/n/${id}`;
export const quoteHref = (q: Pick<Quote, "id" | "source">) => (q.source ? `${sourceHref(q.source)}#q-${q.id}` : QUOTES_HREF);

export function sourceKindLabel(kind: string | undefined): string | undefined {
  return SOURCE_KINDS.find((k) => k.value === kind)?.label;
}
