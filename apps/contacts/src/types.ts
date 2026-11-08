import { getDocument, type DocumentTypeDef } from "@lifeline/core";
import { PEOPLE_FOLDER, PERSON, TIE, type Person } from "./domain/types";
import { removeTiesOf, tieIdsOf } from "./data/ties";
import { personHref } from "./constants";
import { addressPinsOf } from "./domain/addresses";

/**
 * The Person type (ADR 0113), UI-free: the icon and the Peek are attached in
 * index.ts so tests don't pull the UI kit. Its Relationship is the App's own
 * Field; aliases are the Known Field the Linkable Contract reads.
 */
export const personTypeDef: DocumentTypeDef = {
  id: PERSON,
  label: "People",
  singular: "Person",
  iconName: "user",
  titleRule: "name",
  body: "optional",
  folder: PEOPLE_FOLDER,
  linkable: { subtitle: (d) => ((d as Person).relationship?.trim() ? `Person · ${(d as Person).relationship.trim()}` : "Person") },
  // Opens on its own page; its Peek's "Open" leads there (ADR 0110's pattern).
  href: (d) => personHref(d.id),
  // A Pin for each current Address with coordinates, through the App's code and no geo Field (#418).
  locatablePins: addressPinsOf,
  // Seen and Mentioned side by side, never added together (ADR 0112).
  reports: [{ kind: "lastSeen" }, { kind: "last" }],
  order: 30,
  builtIn: true,
  // Their Ties go with them, and move with them between Workspaces (#412).
  onDelete: (doc) => removeTiesOf(doc.id),
  followers: (doc) => tieIdsOf(doc.id),
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "relationship", label: "Relationship", kind: "text", column: true },
    // Left out of Drifting by choice (#420): set on the Person's page or from their Drifting row.
    { key: "excludedFromDrifting", label: "Excluded from Drifting", kind: "boolean" },
    // The App's own parts, declared so a Field of the user's can never take their keys (`merge` keeps the
    // built-in's): guarded, hidden and json, so no Base, form or agent writes them (ADR 0114).
    { key: "addresses", label: "Addresses", kind: "json", guarded: true, hidden: true },
    { key: "contactDetails", label: "Contact details", kind: "json", guarded: true, hidden: true },
  ],
};

/**
 * The Tie (#412): internal, so it is no link target and counts for no
 * Backlink or Report (its two ids are Links Fields the index skips for an
 * internal type). It holds both Person ids and a word for each end; guarded,
 * since the Person page is the only way to change one.
 */
export const tieTypeDef: DocumentTypeDef = {
  id: TIE,
  label: "Ties",
  iconName: "link",
  internal: true,
  titleRule: "name",
  body: "none",
  builtIn: true,
  fields: [
    { key: "a", label: "Person", kind: "link", linkType: PERSON, guarded: true },
    { key: "b", label: "Other person", kind: "link", linkType: PERSON, guarded: true },
    { key: "labelA", label: "What the first is to the second", kind: "text", guarded: true },
    { key: "labelB", label: "What the second is to the first", kind: "text", guarded: true },
  ],
  // Either Person speaks for it.
  owner: async (doc) => (typeof doc.a === "string" ? getDocument(doc.a) : undefined),
};
