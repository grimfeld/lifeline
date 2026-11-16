import { PERSON_TYPE } from "./people";
import type { Document } from "./documents/types";

/**
 * The id of the Place type (ADR 0119), which the Atlas App owns. Core names it
 * so that other Apps (an Event's At, the World map) can reach Places without
 * importing Atlas (ADR 0100). Prefixed, so a user-defined `place` type stays
 * the user's own.
 */
export const PLACE_TYPE = "atlas_place";

/**
 * What an Event's At names (ADR 0119): the live Place or Person `doc` is,
 * as its id and title. Nothing for a missing or deleted Document, or one of
 * another type (a stale At) — the one rule the At chip, the Timed items and
 * the agent view all share.
 */
export function atTarget(doc: Document | undefined, id: string): { docId: string; title: string } | undefined {
  if (!doc || doc.id !== id || doc.deleted) return undefined;
  return doc.type === PLACE_TYPE || doc.type === PERSON_TYPE ? { docId: doc.id, title: doc.title } : undefined;
}
