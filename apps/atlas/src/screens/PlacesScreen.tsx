import { useMemo, useState } from "react";
import { Link } from "react-router";
import { todayStr, useDocumentTypes, useLinkIndex } from "@lifeline/core";
import { Badge, Button, EmptyState, Page, PageHeader, PhoneDock, PhoneFilters, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, ToggleGroup, ToggleGroupItem } from "@lifeline/ui";
import { MapPinPlus, Tags } from "lucide-react";
import { AddPlaceDialog } from "../components/AddPlaceDialog";
import { KindsDialog } from "../components/KindsDialog";
import { kindLabel, kindOptions, lastVisitOf, placesList, type PlacesShown, type PlacesSort } from "../domain/place";
import { type Place } from "../domain/types";
import { usePlaces } from "../data/repo";
import { placeHref } from "../constants";

const ANY = "__any__";

/** The three lists, and what each says when the Kind leaves none. */
const LISTS: { value: PlacesShown; label: string; none: string }[] = [
  { value: "open", label: "All", none: "No Place of that Kind." },
  { value: "toTry", label: "To try", none: "No Place to try here: mark one To try on its page." },
  { value: "closed", label: "Closed", none: "No closed Place here." },
];

/** The two orders (#487 story 58): by name, or by when I last went. */
const SORTS: { value: PlacesSort; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "lastVisit", label: "Last visit" },
];

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
 * name or by last visit (the Places never visited last), filtered by Kind. All leaves the closed ones out; To try lists those
 * marked, open ones only; Closed lists the rest. "Kinds" renames and adds them.
 */
export function PlacesScreen() {
  const [adding, setAdding] = useState(false);
  const [editingKinds, setEditingKinds] = useState(false);
  const [kind, setKind] = useState("");
  const [show, setShow] = useState<PlacesShown>("open");
  const [sort, setSort] = useState<PlacesSort>("name");
  const index = useLinkIndex();
  useDocumentTypes();
  const places = usePlaces();
  const options = kindOptions();
  // A Kind no Place has any more is still a filter, showing none: the Kinds are the user's list, not the Places'.
  const shown = useMemo(() => {
    const today = todayStr();
    return placesList(places, { kind, show, sort, lastVisit: (id) => lastVisitOf(index, id, today) });
  }, [places, kind, show, sort, index]);
  const none = LISTS.find((l) => l.value === show)?.none ?? "";
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
            <PhoneFilters active={+(kind !== "") + +(show !== "open") + +(sort !== "name")}>
              <ToggleGroup value={show} onValueChange={(v) => setShow(v as PlacesShown)} aria-label="Which Places">
                {LISTS.map((l) => (
                  <ToggleGroupItem key={l.value} value={l.value} aria-label={l.label}>
                    {l.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
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
              <Select value={sort} onValueChange={(v) => setSort(v as PlacesSort)}>
                <SelectTrigger className="w-full min-w-0 md:w-40" aria-label="Sort">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PhoneFilters>
          </PhoneDock>
          {shown.length === 0 ? (
            <p className="text-muted-foreground text-sm">{kind ? "No Place of that Kind." : none}</p>
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
