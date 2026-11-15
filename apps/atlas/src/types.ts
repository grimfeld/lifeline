import { PLACE_TYPE, type DocumentTypeDef } from "@lifeline/core";
import { KINDS, PLACES_FOLDER } from "./domain/types";
import { placeCoordsOf, placeSubtitle } from "./domain/place";
import { placeHref } from "./constants";
import { PlaceTaken, addPlace } from "./data/repo";

/**
 * The Place type (ADR 0119), UI-free: the icon and the Peek are attached in
 * index.ts so tests don't pull the UI kit. Its Kind is the App's own Choice,
 * whose options the user may rename and add to; aliases are the Known Field
 * the Linkable Contract reads. Places are open to agents: no wall.
 */
export const placeTypeDef: DocumentTypeDef = {
  id: PLACE_TYPE,
  label: "Places",
  singular: "Place",
  iconName: "map-pin",
  titleRule: "name",
  body: "optional",
  folder: PLACES_FOLDER,
  // The completer and the Peek say what it is: "Place · Restaurant".
  linkable: { subtitle: (d) => placeSubtitle(d) },
  // Opens on its own page; its Peek's "Open" leads there (ADR 0110's pattern).
  href: (d) => placeHref(d.id),
  // A Pin once its address has coordinates: read, never looked up, when a map is drawn (ADR 0011).
  locatable: placeCoordsOf,
  // An agent's search shows what and where each Place is (ADR 0119: Places have no wall).
  searchFields: ["kind", "address"],
  order: 31,
  // Visited is the Seen family in a Place's words (ADR 0119): last visit, visits, and Mentioned beside them, never added.
  // Top visited rolls up on a Journal period and is a placeable Card.
  seenAs: { verb: "visited", one: "visit", many: "visits" },
  reports: [{ kind: "lastSeen" }, { kind: "seenCount" }, { kind: "last" }, { kind: "topSeen", n: 5 }],
  builtIn: true,
  // "Create …" in an Event's At (ADR 0119): a Place by name, or the one that already has it.
  async createNamed(name) {
    try {
      return await addPlace({ name });
    } catch (e) {
      if (e instanceof PlaceTaken) return e.existing;
      throw e;
    }
  },
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "kind", label: "Kind", kind: "select", options: KINDS.map((k) => ({ ...k })), userOptions: true, column: true },
    // Written through the App, so the coordinates always follow the text; agents read both (no wall).
    { key: "address", label: "Address", kind: "text", guarded: true, column: true },
    { key: "geo", label: "Coordinates", kind: "geo", guarded: true },
  ],
};
