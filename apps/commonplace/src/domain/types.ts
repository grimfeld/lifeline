import type { DateStr, Document } from "@lifeline/core";

/**
 * A Quote (CONTEXT.md): a passage kept from a work of any family — owned by
 * the Commonplace book App (ADR 0024) and impossible without the work it
 * links to, whatever App owns that work. `locator` is free text (page,
 * chapter, time).
 */
export interface Quote extends Document {
  mediaId: string;
  text: string;
  locator: string;
  comment: string;
  capturedOn: DateStr;
}

export const QUOTES = "quote";
