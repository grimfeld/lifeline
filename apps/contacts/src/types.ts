import { PERSON_TYPE, getDocument, type DocumentTypeDef } from "@lifeline/core";
import { AGENT_WALLED_KEYS, HOUSEHOLD, HOUSEHOLDS_FOLDER, PEOPLE_FOLDER, TIE, type Person } from "./domain/types";
import { describeHousehold, describePerson } from "./describe";
import { removeTiesOf, tieIdsOf } from "./data/ties";
import { householdHref, personHref } from "./constants";
import { dropMembersOutside, dropMembershipsOf } from "./data/households";
import { memberSpansOf } from "./domain/households";
import { addressPinsOf } from "./domain/addresses";

/**
 * The Person type (ADR 0113), UI-free: the icon and the Peek are attached in
 * index.ts so tests don't pull the UI kit. Its Relationship is the App's own
 * Field; aliases are the Known Field the Linkable Contract reads.
 */
export const personTypeDef: DocumentTypeDef = {
  id: PERSON_TYPE,
  label: "People",
  singular: "Person",
  iconName: "user",
  titleRule: "name",
  body: "optional",
  folder: PEOPLE_FOLDER,
  linkable: {
    subtitle: (d) => ((d as Person).relationship?.trim() ? `Person · ${(d as Person).relationship.trim()}` : "Person"),
    // [[Anne]] reaches them by their Given name, read from the Field and never copied into Aliases (ADR 0117).
    extraNames: (d) => [typeof d.givenName === "string" ? d.givenName : ""],
  },
  // Opens on its own page; its Peek's "Open" leads there (ADR 0110's pattern).
  href: (d) => personHref(d.id),
  // A Pin for each current Address with coordinates, through the App's code and no geo Field (#418).
  locatablePins: addressPinsOf,
  // Seen and Mentioned side by side, never added together (ADR 0112); Top seen rolls up on a Journal period (ADR 0128).
  reports: [{ kind: "lastSeen" }, { kind: "last" }, { kind: "topSeen", n: 5 }],
  order: 30,
  builtIn: true,
  // Their Ties go with them, and move with them between Workspaces (#412); their place in any Household goes too (ADR 0117).
  onDelete: async (doc) => {
    await removeTiesOf(doc.id);
    await dropMembershipsOf(doc.id);
  },
  followers: (doc) => tieIdsOf(doc.id),
  // Out of the Households they leave behind: members belong to the Household's Workspace (ADR 0117).
  onMove: (doc, workspace) => dropMembershipsOf(doc.id, workspace),
  // Gone from every People field too (an Event's With, a Task's For…): the other Apps never import Contacts.
  unlinkOnDelete: true,
  // An agent reads their Ties and Reports (#404 story 92), and never their Addresses or Contact details (ADR 0114).
  describe: describePerson,
  agentWalled: AGENT_WALLED_KEYS,
  fields: [
    // Beside the title, never part of it after add (ADR 0117).
    { key: "givenName", label: "Given name", kind: "text", column: true },
    { key: "familyName", label: "Family name", kind: "text", column: true },
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "relationship", label: "Relationship", kind: "text", column: true },
    // Left out of Drifting by choice (#420): set on the Person's page or from their Drifting row.
    { key: "excludedFromDrifting", label: "Excluded from Drifting", kind: "boolean" },
    // The App's own parts, declared so a Field of the user's can never take their keys (`merge` keeps the
    // built-in's): guarded, hidden and json, so no Base, form or agent writes them (ADR 0114).
    { key: "occasions", label: "Occasions", kind: "json", guarded: true, hidden: true },
    { key: "addresses", label: "Addresses", kind: "json", guarded: true, hidden: true },
    { key: "contactDetails", label: "Contact details", kind: "json", guarded: true, hidden: true },
    // Suggested Ties dismissed for good (ADR 0130), written on both People of the pair.
    { key: "dismissedTies", label: "Dismissed suggested ties", kind: "json", guarded: true, hidden: true },
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
    { key: "a", label: "Person", kind: "link", linkType: PERSON_TYPE, guarded: true },
    { key: "b", label: "Other person", kind: "link", linkType: PERSON_TYPE, guarded: true },
    { key: "labelA", label: "What the first is to the second", kind: "text", guarded: true },
    { key: "labelB", label: "What the second is to the first", kind: "text", guarded: true },
    // What the words mean, a to b (ADR 0130): optional, guarded, hidden; the words stay what is shown.
    { key: "kind", label: "Kind", kind: "text", guarded: true, hidden: true },
  ],
  // Either Person speaks for it.
  owner: async (doc) => (typeof doc.a === "string" ? getDocument(doc.a) : undefined),
};

/**
 * The Household (ADR 0117): the People who live together, Linkable by its
 * title and aliases, with a body. Its members are the Contacts App's own part
 * (guarded, hidden json), chosen on its page, its Peek or a Person's page,
 * never by a Base or an agent. It holds nothing of a Person's, so deleting it
 * touches no one, and nothing walled reaches an agent through it.
 */
export const householdTypeDef: DocumentTypeDef = {
  id: HOUSEHOLD,
  label: "Households",
  singular: "Household",
  iconName: "home",
  titleRule: "name",
  body: "optional",
  folder: HOUSEHOLDS_FOLDER,
  // A link to it counts for whoever was a member on the source's day (ADR 0117): Core's `reaches`.
  linkable: { subtitle: () => "Household", members: (doc) => memberSpansOf(doc.members) },
  href: (d) => householdHref(d.id),
  // Its own page's Reports, as a Person's (ADR 0112): what links to it by name, never through its members.
  reports: [{ kind: "lastSeen" }, { kind: "last" }],
  order: 31,
  builtIn: true,
  // An agent reads its name, aliases and the names of its members (ADR 0117), as it reads a Person.
  describe: describeHousehold,
  // Moved, it keeps only the members in its new Workspace (ADR 0117); a Person moved with it stays.
  onMove: (doc, workspace) => dropMembersOutside(doc.id, workspace),
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    // `{ personId, since?, until? }[]` (`Membership`): only the App's own controls write it.
    { key: "members", label: "Members", kind: "json", guarded: true, hidden: true },
  ],
};
