import { TitleTaken, type CommandDef } from "@lifeline/core";
import { MapPin, MapPinPlus } from "lucide-react";
import { AddPlaceDialog } from "./components/AddPlaceDialog";
import { addPlace } from "./data/repo";
import { PLACES_HREF } from "./constants";

/**
 * The Atlas App's Commands. "places.add" is also the agents' `places_add`
 * (ADR 0128): its id makes the tool's name, so it keeps it.
 */
export const atlasCommands: CommandDef[] = [
  {
    id: "places.add",
    title: "Add place…",
    keywords: ["place", "places", "restaurant", "cafe", "café", "bar", "museum", "shop", "spot", "atlas"],
    icon: MapPinPlus,
    dialog: AddPlaceDialog,
    capture: true,
    args: [
      { key: "name", label: "Name", kind: "text", required: true, hint: "Its name, as you'd write it in a [[link]]; a branch of a chain is its own Place (\"Lidl Prado\"). Places' names are unique." },
      // Text, not a fixed list: the user renames and adds Kinds, so they are checked when the tool runs.
      { key: "kind", label: "Kind", kind: "text", hint: "Optional: restaurant, café, bar, museum, gallery, shop, mall, park, venue, other, or a Kind of the user's own (list_types shows them)." },
      { key: "address", label: "Address", kind: "text", hint: "Optional: its postal address (\"2 Rue Roger Verlomme, Paris\"); looked up once to put it on the map." },
      { key: "aliases", label: "Aliases", kind: "list", hint: "Optional: other names for it (\"Janou\"); each one links to it." },
      { key: "tags", label: "Tags", kind: "list", hint: "Optional: Tags to file it under (\"cuisine/japanese\")." },
      { key: "toTry", label: "To try", kind: "boolean", hint: "Optional: true to put it on the user's To try list, a place they want to go. It clears by itself once an Event there has happened." },
    ],
    returnsDocument: true,
    async invoke(a) {
      try {
        const p = await addPlace({ name: String(a.name ?? ""), kind: a.kind as string | undefined, aliases: a.aliases as string[] | undefined, tags: a.tags as string[] | undefined, address: a.address as string | undefined, toTry: a.toTry === true });
        const where = p.address ? (p.geo ? ", on the map" : ", but its address was found nowhere: it is off the map") : "";
        return { message: `Added ${p.title} to Places${p.toTry ? ", To try" : ""}${where}`, id: p.id };
      } catch (e) {
        // The agent can use the Place there is rather than make another.
        if (e instanceof TitleTaken) throw new Error(`${e.message} (id ${e.existing.id})`);
        throw e;
      }
    },
  },
  { id: "places.open", title: "Go to Places", keywords: ["places", "atlas", "restaurants", "museums"], icon: MapPin, run: ({ navigate }) => navigate(PLACES_HREF) },
];
