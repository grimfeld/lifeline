import { PLACE_TYPE, type Document } from "@lifeline/core";

/**
 * The Place (CONTEXT.md, ADR 0119): one particular spot I can go to. The
 * Atlas App's built-in type, in the World Module: Linkable by name and
 * aliases, with a Kind, Tags, a body, an address, and the two marks To try
 * and closed.
 */
export interface Place extends Document {
  type: typeof PLACE_TYPE;
  aliases: string[];
  /** A Kind option's value; "" for none. */
  kind: string;
  /** Its postal address as written or picked; "" for none. */
  address: string;
  /**
   * Its coordinates, `[lat, lon]`, found when the address was picked or saved
   * (ADR 0011), never when a map is drawn; null while none was found.
   */
  geo: [number, number] | null;
  /** On my list of places to go; Atlas clears it once an Event that links here has happened. */
  toTry: boolean;
  /** Shut for good: off the map and the lists of places to go, its links, body and history kept. */
  closed: boolean;
}

/** Where every Place lands: one folder, so Core's per-folder title check covers Places as one set. */
export const PLACES_FOLDER = "Places";

/** The Kinds a Place starts with (ADR 0119); the user renames and adds through the type (`userOptions`). */
export const KINDS = [
  { value: "restaurant", label: "Restaurant" },
  { value: "cafe", label: "Café" },
  { value: "bar", label: "Bar" },
  { value: "museum", label: "Museum" },
  { value: "gallery", label: "Gallery" },
  { value: "shop", label: "Shop" },
  { value: "mall", label: "Mall" },
  { value: "park", label: "Park" },
  { value: "venue", label: "Venue" },
  { value: "other", label: "Other" },
] as const;
