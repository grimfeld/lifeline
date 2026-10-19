import { useMemo, useState } from "react";
import { Button, Card, CardContent, Input, PhoneDock, PhoneFilters, usePhone, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { ShelfControl } from "@lifeline/parts";
import { Plus, Settings2, SlidersHorizontal } from "lucide-react";
import type { Work } from "../domain/types";
import { useWorks } from "../data/repo";
import { GALLERY_SORTS, matchesSearch, onShelf, SHELVES, shelfLabel, sortGallery, type GallerySort, type Shelf } from "../domain/browse";
import { AddWorkDialog } from "../components/AddWorkDialog";
import { WorkTile } from "../components/WorkTile";
import { WorkDetailDialog } from "../components/WorkDetailDialog";
import { EditWorkDialog } from "../components/WorkRow";
import { QuickAdd } from "../components/QuickAdd";
import { LookupSettingsDialog } from "../components/LookupSettingsDialog";

function emptyMessage(shelf: Shelf): string {
  switch (shelf) {
    case "UNSTARTED":
      return "Nothing to play yet — add something above.";
    case "IN_PROGRESS":
      return "Nothing being played — start something from the shelf.";
    case "DONE":
      return "Nothing played yet.";
    case "ABANDONED":
      return "Nothing dropped.";
    default:
      return "The Arcade is empty — add your first game above.";
  }
}

/** The Arcade (ADR 0024): the Gallery of games you land on. */
export function ArcadeScreen() {
  const items = useWorks();
  const [addOpen, setAddOpen] = useState(false);
  const phone = usePhone();
  const [lookupOpen, setLookupOpen] = useState(false);
  const [editing, setEditing] = useState<Work | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [shelf, setShelf] = useState<Shelf>("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<GallerySort>("ADDED");

  const shelfCounts = useMemo(() => new Map<Shelf, number>(SHELVES.map((s) => [s, items.filter((m) => onShelf(m, s)).length])), [items]);
  const gallery = useMemo(() => sortGallery(items.filter((m) => onShelf(m, shelf)).filter((m) => matchesSearch(m, q)), sort), [items, shelf, q, sort]);
  // Resolve by id so the dialog re-renders with the live record after each transition.
  const viewing = viewingId ? (items.find((m) => m.id === viewingId) ?? null) : null;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 p-6">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Arcade</h1>
          <PhoneDock>
            <div className="flex items-center gap-2 max-md:contents">
              {/* Phone: an icon, so search, Filters and the adds share one line. */}
              <Button variant="outline" size={phone ? "icon-sm" : "sm"} aria-label={phone ? "Add with details" : undefined} title={phone ? "Add with details" : undefined} onClick={() => setAddOpen(true)}>
                {phone ? <Plus /> : <><SlidersHorizontal /> Add with details…</>}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Arcade lookup settings" title="Lookup settings" onClick={() => setLookupOpen(true)}>
                <Settings2 />
              </Button>
            </div>
          </PhoneDock>
        </div>
        <QuickAdd />
      </div>

      {/* The Shelf: above the search on the desk, a select in the Phone dock on a phone. */}
      <PhoneDock order={1}>
        <ShelfControl shelves={SHELVES} value={shelf} onChange={setShelf} labelOf={(s) => shelfLabel(s, "game")} counts={shelfCounts} />
      </PhoneDock>
      <PhoneDock>
        {/* Phone: the sort goes in the Filters sheet. */}
        <div className="flex flex-1 flex-wrap gap-2 max-md:contents">
          <Input className="flex-1 md:min-w-40 max-md:w-auto max-md:basis-36" placeholder="Search title, developer, reason, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          <PhoneFilters active={+(sort !== "ADDED")}>
            <Select value={sort} onValueChange={(v) => setSort(v as GallerySort)}>
              <SelectTrigger className="w-44" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GALLERY_SORTS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </PhoneFilters>
        </div>
      </PhoneDock>

      {gallery.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">{q.trim() ? "Nothing matches that search." : emptyMessage(shelf)}</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-4">
          {gallery.map((m) => (
            <WorkTile key={m.id} item={m} onOpen={(it) => setViewingId(it.id)} />
          ))}
        </div>
      )}

      <WorkDetailDialog item={viewing} onClose={() => setViewingId(null)} onEdit={setEditing} />
      <AddWorkDialog open={addOpen} onOpenChange={setAddOpen} defaultType="game" />
      <EditWorkDialog item={editing} onClose={() => setEditing(null)} />
      <LookupSettingsDialog open={lookupOpen} onOpenChange={setLookupOpen} />
    </div>
  );
}
