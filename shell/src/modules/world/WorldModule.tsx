import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { EVENT_TYPE, PLACE_TYPE, appById, documentType, openPin, useDocumentTypes, useDocuments, useLocatablePins } from "@lifeline/core";
import { FilterChip, MapView, PageHeader, PhoneDock, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { Map as MapIcon, MapPin, Sparkles, Users } from "lucide-react";
import { handModule } from "../handModule";
import { worldPins } from "./worldMap";

/** The Apps (and the Event type, #505) whose Pins the World map shows, and what each chip calls them. Stable, so the Pins hook keeps its memo. */
const WORLD_APPS = ["atlas", "contacts", EVENT_TYPE];
const CHIPS = [
  { appId: "atlas", label: "Places" },
  { appId: "contacts", label: "People" },
  { appId: "calendar", label: "Events" },
];
const ANY = "__any__";

/**
 * World's home (ADR 0119): one map of every Place and every current Address,
 * told apart by Atlas's and Contacts' colours, and of every Event At one of
 * them (ADR 0122), in the Calendar's. A chip turns one App's Pins
 * off; the Kind and To try narrow the Places, together, and the Events At them. The Pins are what Core reads from stored
 * coordinates: drawing the map looks nothing up (ADR 0011).
 */
function WorldMap() {
  const navigate = useNavigate();
  const all = useLocatablePins(WORLD_APPS);
  const places = useDocuments(PLACE_TYPE);
  // An Event At a Place follows its Place through Kind and To try (#505): its At is read from it.
  const events = useDocuments(EVENT_TYPE);
  const docs = useMemo(() => [...places, ...events], [places, events]);
  useDocumentTypes();
  const kinds = documentType(PLACE_TYPE)?.fields.find((f) => f.key === "kind")?.options ?? [];
  const [hidden, setHidden] = useState<string[]>([]);
  const [kind, setKind] = useState("");
  const [toTry, setToTry] = useState(false);
  const pins = useMemo(() => worldPins(all, docs, { hidden, kind, toTry }), [all, docs, hidden, kind, toTry]);
  const chips = CHIPS.filter((c) => appById(c.appId));
  const toggle = (appId: string) => setHidden((h) => (h.includes(appId) ? h.filter((x) => x !== appId) : [...h, appId]));

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex min-w-0 flex-wrap items-center gap-2 border-b px-4 py-2">
        <PageHeader title="World" className="w-auto" />
        <span className="text-muted-foreground text-xs tabular-nums">
          {pins.length} {pins.length === 1 ? "pin" : "pins"}
        </span>
        <PhoneDock order={1}>
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-1 max-md:w-full">
            {chips.map((c) => {
              const on = !hidden.includes(c.appId);
              const count = all.filter((p) => p.appId === c.appId).length;
              return (
                <FilterChip key={c.appId} on={on} onClick={() => toggle(c.appId)}>
                  <span className="size-2 rounded-full" style={{ background: appById(c.appId)?.color }} />
                  {c.label}
                  <span className="text-muted-foreground tabular-nums">{count}</span>
                </FilterChip>
              );
            })}
            <FilterChip on={toTry} onClick={() => setToTry((on) => !on)}>
              <Sparkles className="size-3" /> To try
            </FilterChip>
            <Select value={kind || ANY} onValueChange={(v) => setKind(v === ANY ? "" : v)}>
              <SelectTrigger size="sm" className="min-w-0 max-md:h-8 max-md:flex-1 md:w-40" aria-label="Kind">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY}>Any kind</SelectItem>
                {kinds.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PhoneDock>
      </div>
      {all.length === 0 && (
        <p className="text-muted-foreground border-b px-4 py-2 text-sm">Nothing on the map yet: give a Place its address, or a Person an Address.</p>
      )}
      <div className="min-h-0 flex-1 p-2">
        <MapView pins={pins} onOpen={(p) => openPin(p, navigate)} />
      </div>
    </div>
  );
}

/**
 * World (ADR 0119): the People Module retitled, Contacts and Atlas side by
 * side. It opens on the map of both; People and Places keep their screens.
 */
export const worldShell = handModule({
  id: "people",
  title: "World",
  places: [
    { key: "map", title: "Map", icon: MapIcon, page: "" },
    { key: "people", title: "People", icon: Users, screen: "contacts.people" },
    { key: "places", title: "Places", icon: MapPin, screen: "atlas.places" },
  ],
  pages: [{ path: "", component: WorldMap, bare: true }],
});
