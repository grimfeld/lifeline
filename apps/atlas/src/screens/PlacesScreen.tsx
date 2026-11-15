import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useDocumentTypes } from "@lifeline/core";
import { Badge, Button, EmptyState, Page, PageHeader, PhoneDock, PhoneFilters, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { MapPinPlus, Tags } from "lucide-react";
import { AddPlaceDialog } from "../components/AddPlaceDialog";
import { KindsDialog } from "../components/KindsDialog";
import { kindLabel, placesList } from "../domain/place";
import { type Place } from "../domain/types";
import { kindOptions, usePlaces } from "../data/repo";
import { placeHref } from "../constants";

const ANY = "__any__";

/** One Place in the list: its name, its Kind and Tags; a link to its page. */
function PlaceRow({ place, showKind }: { place: Place; showKind: boolean }) {
  return (
    <li className="min-w-0">
      <Link to={placeHref(place.id)} className="hover:bg-accent focus-visible:ring-ring flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 focus-visible:ring-2 focus-visible:outline-none">
        <span className="min-w-0 truncate font-medium">{place.title}</span>
        <span className="flex min-w-0 flex-wrap gap-1">
          {showKind && place.kind && (
            <Badge variant="secondary" className="max-w-full">
              <span className="min-w-0 truncate">{kindLabel(place.kind)}</span>
            </Badge>
          )}
          {place.tags.map((t) => (
            <Badge key={t} variant="outline" className="max-w-full">
              <span className="min-w-0 truncate">#{t}</span>
            </Badge>
          ))}
        </span>
      </Link>
    </li>
  );
}

/**
 * Atlas's Places screen (ADR 0119): every Place in the Workspace, A to Z by
 * name, filtered by Kind. "Kinds" renames and adds them.
 */
export function PlacesScreen() {
  const [adding, setAdding] = useState(false);
  const [editingKinds, setEditingKinds] = useState(false);
  const [kind, setKind] = useState("");
  useDocumentTypes();
  const places = usePlaces();
  const options = kindOptions();
  // A Kind no Place has any more is still a filter, showing none: the Kinds are the user's list, not the Places'.
  const shown = useMemo(() => placesList(places, { kind }), [places, kind]);
  const add = (
    <Button onClick={() => setAdding(true)}>
      <MapPinPlus /> Add place
    </Button>
  );

  return (
    <Page>
      <PageHeader title="Places">
        <Button variant="outline" onClick={() => setEditingKinds(true)}>
          <Tags /> Kinds
        </Button>
        {places.length > 0 ? add : null}
      </PageHeader>
      {places.length === 0 ? (
        <EmptyState action={add}>The places you go: restaurants, cafés, museums. Add one, then link it from any page with [[its name]].</EmptyState>
      ) : (
        <>
          <PhoneDock>
            <PhoneFilters active={+(kind !== "")}>
              <Select value={kind || ANY} onValueChange={(v) => setKind(v === ANY ? "" : v)}>
                <SelectTrigger className="w-full min-w-0 md:w-48" aria-label="Kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY}>Any kind</SelectItem>
                  {options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PhoneFilters>
          </PhoneDock>
          {shown.length === 0 ? (
            <p className="text-muted-foreground text-sm">No Place of that Kind.</p>
          ) : (
            <ul className="grid min-w-0" aria-label="Places">
              {shown.map((p) => (
                <PlaceRow key={p.id} place={p} showKind={!kind} />
              ))}
            </ul>
          )}
        </>
      )}
      <AddPlaceDialog open={adding} onOpenChange={setAdding} />
      <KindsDialog open={editingKinds} onOpenChange={setEditingKinds} />
    </Page>
  );
}
