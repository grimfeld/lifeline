import type { Document, DocumentTypeDef } from "@lifeline/core";

export const APP_ID = "clipper";
export const CLIPPING = "clipping";
export const CLIPPINGS_HREF = "/app/clippings";

/**
 * A Clipping (CONTEXT.md): text I pasted from outside, kept with its
 * source. Lifeline never fetches it — the Clipper only records what I bring.
 */
export interface Clipping extends Document {
  type: typeof CLIPPING;
  body: string;
  /** Where it came from: a URL, or a name ("Le Monde, print"). */
  source: string;
  author: string;
  /** ISO instant of capture. */
  capturedAt: string;
  /** Day it was published, if known. */
  publishedAt: string;
}

export const clippingType: DocumentTypeDef = {
  id: CLIPPING,
  label: "Clippings",
  iconName: "scissors",
  titleRule: "name",
  body: "required",
  folder: "Clippings",
  linkable: { subtitle: (d) => hostOf(String(d.source ?? "")) || undefined },
  fields: [
    { key: "source", label: "Source", kind: "url", column: true },
    { key: "author", label: "Author", kind: "text", column: true },
    { key: "publishedAt", label: "Published", kind: "date", column: true },
    { key: "capturedAt", label: "Captured", kind: "datetime", guarded: true, column: true },
  ],
  indexes: ["capturedAt"],
  order: 20,
  builtIn: true,
};

/** Hostname of a URL-ish source, "" when it's not a URL. */
export function hostOf(source: string): string {
  try {
    return new URL(source).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
