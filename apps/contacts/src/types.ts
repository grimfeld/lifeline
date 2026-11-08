import type { DocumentTypeDef } from "@lifeline/core";
import { PEOPLE_FOLDER, PERSON, type Person } from "./domain/types";
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
  order: 30,
  builtIn: true,
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "relationship", label: "Relationship", kind: "text", column: true },
    // The App's own parts, declared so a Field of the user's can never take their keys (`merge` keeps the
    // built-in's): guarded, hidden and json, so no Base, form or agent writes them (ADR 0114).
    { key: "addresses", label: "Addresses", kind: "json", guarded: true, hidden: true },
    { key: "contactDetails", label: "Contact details", kind: "json", guarded: true, hidden: true },
  ],
};
