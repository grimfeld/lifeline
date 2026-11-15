import { PLACE_TYPE, type DocumentTypeDef } from "@lifeline/core";
import { KINDS, PLACES_FOLDER } from "./domain/types";
import { placeSubtitle } from "./domain/place";
import { placeHref } from "./constants";

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
  order: 31,
  builtIn: true,
  fields: [
    { key: "aliases", label: "Aliases", kind: "list" },
    { key: "kind", label: "Kind", kind: "select", options: KINDS.map((k) => ({ ...k })), userOptions: true, column: true },
  ],
};
