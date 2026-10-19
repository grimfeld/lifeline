import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn, Input, PhoneDock, PhoneFilters, usePhone, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@lifeline/ui";
import { ShelfControl } from "@lifeline/parts";
import { Heart, Plus, SlidersHorizontal, Sparkles } from "lucide-react";
import type { Work } from "../domain/types";
import { useWorks } from "../data/repo";
import { GALLERY_SORTS, isLiked, matchesSearch, onShelf, SHELVES, shelfLabel, sortGallery, type GallerySort, type Shelf } from "../domain/browse";
import { PlaylistsTab } from "../components/PlaylistsTab";
import { usePlaylists } from "../data/repo";
import { AddWorkDialog } from "../components/AddWorkDialog";
import { WorkTile } from "../components/WorkTile";
import { WorkDetailDialog } from "../components/WorkDetailDialog";
import { EditWorkDialog } from "../components/WorkRow";
import { QuickAdd } from "../components/QuickAdd";
import { EnrichDialog } from "../components/EnrichDialog";

/** The ♥ chip (ADR 0035): only what I liked. */
function LikedChip({ value, onChange, count }: { value: boolean; onChange: (v: boolean) => void; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={value}
      title="Only what I liked"
      className={cn("inline-flex w-fit items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors", value ? "border-rose-500 bg-rose-500 text-white" : "hover:bg-accent")}
      onClick={() => onChange(!value)}
    >
      <Heart className={cn("size-3", value && "fill-current")} /> Liked
      {count ? <span className="opacity-70">{count}</span> : null}
    </button>
  );
}

function emptyMessage(shelf: Shelf): string {
  switch (shelf) {
    case "UNSTARTED":
      return "Nothing to listen to yet — add something above.";
    case "IN_PROGRESS":
      return "Nothing playing — start something from the shelf.";
    case "DONE":
      return "Nothing listened yet.";
    case "ABANDONED":
      return "Nothing dropped.";
    default:
      return "The Discotheque is empty — add your first album above.";
  }
}

/** The Discotheque (ADR 0024): the Gallery of albums you land on. */
export function DiscothequeScreen() {
  const items = useWorks();
  const [addOpen, setAddOpen] = useState(false);
  const phone = usePhone();
  const [lookupOpen, setLookupOpen] = useState(false);
  const [editing, setEditing] = useState<Work | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [shelf, setShelf] = useState<Shelf>("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<GallerySort>("ADDED");
  const [likedOnly, setLikedOnly] = useState(false);
  const playlistCount = usePlaylists().length;

  const shelfCounts = useMemo(() => new Map<Shelf, number>(SHELVES.map((s) => [s, items.filter((m) => onShelf(m, s)).length])), [items]);
  const likedCount = useMemo(() => items.filter(isLiked).length, [items]);
  const gallery = useMemo(
    () => sortGallery(items.filter((m) => onShelf(m, shelf) && (!likedOnly || isLiked(m)) && matchesSearch(m, q)), sort),
    [items, shelf, likedOnly, q, sort],
  );
  // Resolve by id so the dialog re-renders with the live record after each transition.
  const viewing = viewingId ? (items.find((m) => m.id === viewingId) ?? null) : null;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 p-6">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Discotheque</h1>
          <PhoneDock>
            <div className="flex items-center gap-2 max-md:contents">
              {/* Phone: an icon, so search, Filters and the adds share one line. */}
              <Button variant="outline" size={phone ? "icon-sm" : "sm"} aria-label={phone ? "Add with details" : undefined} title={phone ? "Add with details" : undefined} onClick={() => setAddOpen(true)}>
                {phone ? <Plus /> : <><SlidersHorizontal /> Add with details…</>}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Enrich from MusicBrainz" title="Enrich from MusicBrainz" onClick={() => setLookupOpen(true)}>
                <Sparkles />
              </Button>
            </div>
          </PhoneDock>
        </div>
        <QuickAdd />
      </div>

      <Tabs defaultValue="gallery">
        <PhoneDock order={1}>
          <TabsList>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="playlists">
              Playlists <span className="ml-1 tabular-nums opacity-60">{playlistCount}</span>
            </TabsTrigger>
          </TabsList>
        </PhoneDock>

        <TabsContent value="gallery" className="grid gap-3 pt-2">
          {/* The Shelf: above the search on the desk, a select in the Phone dock on a phone. */}
          <PhoneDock order={1}>
            <ShelfControl shelves={SHELVES} value={shelf} onChange={setShelf} labelOf={(s) => shelfLabel(s, "music")} counts={shelfCounts} />
          </PhoneDock>
          <PhoneDock>
            {/* Desk: the chips stay above the search (md:-order-1); phone: they and the sort go in the Filters sheet. */}
            <div className="flex flex-1 flex-wrap gap-2 max-md:contents">
              <Input className="flex-1 md:min-w-40 max-md:w-auto max-md:basis-36" placeholder="Search album, artist, reason, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
              <PhoneFilters active={+likedOnly + +(sort !== "ADDED")}>
                <div className="w-full md:-order-1">
                  <LikedChip value={likedOnly} onChange={setLikedOnly} count={likedCount} />
                </div>
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
              <CardContent className="text-muted-foreground p-8 text-center text-sm">{q.trim() ? "Nothing matches that search." : likedOnly ? "Nothing liked here yet." : emptyMessage(shelf)}</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-4">
              {gallery.map((m) => (
                <WorkTile key={m.id} item={m} onOpen={(it) => setViewingId(it.id)} onEdit={setEditing} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="playlists" className="pt-2">
          <PlaylistsTab items={items} onOpenWork={(w) => setViewingId(w.id)} />
        </TabsContent>
      </Tabs>

      <WorkDetailDialog item={viewing} onClose={() => setViewingId(null)} onEdit={setEditing} />
      <AddWorkDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditWorkDialog item={editing} onClose={() => setEditing(null)} />
      <EnrichDialog open={lookupOpen} onOpenChange={setLookupOpen} />
    </div>
  );
}
