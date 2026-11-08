import type { Document } from "@lifeline/core";

/**
 * The Person (CONTEXT.md, ADR 0113): someone I know, or knew. The Contacts
 * App's built-in type, in the People Module — Linkable by name and aliases,
 * mentionable, with a body for what I know of them.
 *
 * Where a Person's structured parts are kept (decided with #408, built by the
 * tickets after it). Each is only ever part of its Person, so each lives on
 * the Person Document itself, under a key the Contacts App owns, guarded and
 * moved only through the App's own page and dialogs (ADR 0019):
 *
 * - `occasions`: `{ id, label, day: "MM-DD" | "YYYY-MM-DD", yearly }[]` — a
 *   day whose year may be unknown (#410).
 * - `addresses`: `Address[]` (below).
 * - `contactDetails`: `ContactDetail[]` (below).
 * - `excludedFromDrifting`: boolean (#413).
 *
 * Keeping Addresses and Contact details as two keys on the Person is what
 * lets the agent wall (ADR 0114) strip them from every answer in one place.
 *
 * The type id is `contacts_person`, not `person`: a user-defined type made
 * before Person was built in is most likely `person` (the Type editor slugs
 * "Person"), and a user record sharing a built-in's id becomes its override
 * (`merge` in Core's type registry). Its Documents would silently turn into
 * Contacts People; ADR 0113 keeps them untouched until the user moves them.
 *
 * A **Tie** is the exception: it is between two People, stored once and read
 * from either end, so it is a Document of its own — an internal `contacts_tie`
 * type holding both ids and a label for each end (#412).
 */
export const PERSON = "contacts_person";

/** Where a new Person lands (a home, never a rule). */
export const PEOPLE_FOLDER = "People";

/**
 * A place a Person lives or can be found (CONTEXT.md "Address"). Only ever
 * part of its Person; never shown to or written by an agent (ADR 0114).
 */
export interface Address {
  id: string;
  /** The user's own label: "Home", "Work", "Holiday house". */
  label: string;
  /** The postal text, as typed. */
  text: string;
  /** Found for `text` when it is saved; absent when the lookup failed. Only a current Address with both is a Pin. */
  lat?: number;
  lon?: number;
  /** They moved: off the map, kept on their page as history. */
  former: boolean;
}

export type ContactKind = "phone" | "email" | "handle";

/**
 * A way to reach a Person (CONTEXT.md "Contact detail"), acted on by a click
 * that follows its kind. Never a Pin; never shown to or written by an agent
 * (ADR 0114).
 */
export interface ContactDetail {
  id: string;
  /** The user's own label: "Mobile", "Work", "Instagram". */
  label: string;
  kind: ContactKind;
  /** The number, the address or the handle, as typed. */
  value: string;
  /** It stopped working: kept as history, no longer offered as a way to reach them. */
  former: boolean;
}

/**
 * The agent wall (ADR 0114): the keys of a Person an agent never reads or
 * writes, current and former alike. The MCP server's handlers strip them from
 * every answer and refuse every write that names them. A part added to Person
 * later that is as private belongs here.
 */
export const AGENT_WALLED_KEYS = ["addresses", "contactDetails"] as const;

export interface Person extends Document {
  type: typeof PERSON;
  /** Other names they go by: `[[Mum]]` lands on Anne Dupont. */
  aliases: string[];
  /** What they are to me, in my own words ("my aunt"); "" when not said. Not a Tie, not a Tag. */
  relationship: string;
  /** What I know of them: my own words. */
  body?: string;
  /** Absent until the first is added. */
  addresses?: Address[];
  contactDetails?: ContactDetail[];
}

/** The internal type of a Tie (#412): stored once, read from either Person. */
export const TIE = "contacts_tie";

/**
 * A **Tie** (CONTEXT.md): how two People stand to each other, stored once.
 * `labelA` is what `a` is to `b` ("mother"), `labelB` what `b` is to `a`
 * ("daughter"). Free words. It never involves the user.
 */
export interface Tie extends Document {
  type: typeof TIE;
  a: string;
  b: string;
  labelA: string;
  labelB: string;
}
