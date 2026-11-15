import { EVENT_TYPE, PLACE_TYPE, TitleTaken, type DocumentTypeDef } from "@lifeline/core";
import { KINDS, PLACES_FOLDER } from "./domain/types";
import { placeCoordsOf, placeSubtitle } from "./domain/place";
import { placeHref } from "./constants";
import { addPlace, afterEventSaved } from "./data/repo";

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
  // Places' titles are unique in every folder (ADR 0119): Core holds it on every write, naming the Place that has it.
  uniqueTitles: true,
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
      if (e instanceof TitleTaken) return e.existing;
      throw e;
    }
  },
  // To try clears once an Event that links here has happened (ADR 0119), however the Event was saved (ADR 0121).
  afterSaveOf: { of: [EVENT_TYPE], run: afterEventSaved },
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "kind", label: "Kind", kind: "select", options: KINDS.map((k) => ({ ...k })), userOptions: true, column: true },
    // Written through the App, so the coordinates always follow the text; agents read both (no wall).
    { key: "address", label: "Address", kind: "text", guarded: true, column: true },
    { key: "geo", label: "Coordinates", kind: "geo", guarded: true },
    // Plain marks, so a list, the map and a Base filter them as fields. To try is cleared by Atlas, never derived.
    { key: "toTry", label: "To try", kind: "boolean" },
    // The day To try was marked: only an Event since then clears it. Atlas writes it with the mark; none on an older mark.
    { key: "toTrySince", label: "To try since", kind: "date", guarded: true, hidden: true },
    { key: "closed", label: "Closed", kind: "boolean" },
  ],
};
