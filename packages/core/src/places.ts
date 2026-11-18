/**
 * The id of the Place type (ADR 0128), which the Atlas App owns. Core names it
 * so that other Apps (an Event's At, the World map) can reach Places without
 * importing Atlas (ADR 0100). Prefixed, so a user-defined `place` type stays
 * the user's own.
 */
export const PLACE_TYPE = "atlas_place";
