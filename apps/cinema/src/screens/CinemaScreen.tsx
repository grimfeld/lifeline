import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn, Input, PhoneDock, PhoneFilters, usePhone, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@lifeline/ui";
import { Heart, Plus, Settings2, SlidersHorizontal } from "lucide-react";
import { WORK_TYPES, type WorkTypeId } from "../domain/workTypes";
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
import { LookupSettingsDialog } from "../components/LookupSettingsDialog";

export type Medium = WorkTypeId | "all";

function TypeChips({ value, onChange, counts, liked, onLiked, likedCount }: { value: Medium; onChange: (v: Medium) => void; counts: Map<string, number>; liked: boolean; onLiked: (v: boolean) => void; likedCount: number }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[{ id: "all" as const, label: "All" }, ...WORK_TYPES.map((t) => ({ id: t.id, label: t.plural }))].map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={value === t.id}
          className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", value === t.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {counts.get(t.id) ? <span className="ml-1 opacity-70">{counts.get(t.id)}</span> : null}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={liked}
        title="Only what I liked"
        className={cn("ml-1 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs transition-colors", liked ? "border-rose-500 bg-rose-500 text-white" : "hover:bg-accent")}
        onClick={() => onLiked(!liked)}
      >
        <Heart className={cn("size-3", liked && "fill-current")} /> Liked
        {likedCount ? <span className="opacity-70">{likedCount}</span> : null}
      </button>
    </div>
  );
}

/** Segmented shelf control in the Cinema's verbs, with counts. */
function ShelfControl({ value, onChange, counts }: { value: Shelf; onChange: (s: Shelf) => void; counts: Map<Shelf, number> }) {
  return (
    <div role="radiogroup" aria-label="Shelf" className="bg-muted text-muted-foreground inline-flex w-fit max-w-full flex-wrap items-center gap-0.5 rounded-lg p-0.5">
      {SHELVES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          className={cn("rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors", value === s ? "bg-background text-foreground shadow-sm" : "hover:text-foreground")}
          onClick={() => onChange(s)}
        >
          {shelfLabel(s, "movie")}
          <span className="ml-1 tabular-nums opacity-60">{counts.get(s) ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

function emptyMessage(shelf: Shelf): string {
  switch (shelf) {
    case "UNSTARTED":
      return "Nothing to watch yet — add something above.";
    case "IN_PROGRESS":
      return "Nothing being watched — start something from the shelf.";
    case "DONE":
      return "Nothing watched yet.";
    case "ABANDONED":
      return "Nothing dropped.";
    default:
      return "The Cinema is empty — add your first movie above.";
  }
}

/** The Cinema (ADR 0024): the Gallery of movies and series you land on. */
export function CinemaScreen() {
  const items = useWorks();
  const [addOpen, setAddOpen] = useState(false);
  const phone = usePhone();
  const [lookupOpen, setLookupOpen] = useState(false);
  const [editing, setEditing] = useState<Work | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [type, setType] = useState<Medium>("all");
  const [shelf, setShelf] = useState<Shelf>("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<GallerySort>("ADDED");
  const [likedOnly, setLikedOnly] = useState(false);
  const playlistCount = usePlaylists().length;

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.type, (m.get(it.type) ?? 0) + 1);
    m.set("all", items.length);
    return m;
  }, [items]);
  const ofMedium = useMemo(() => items.filter((m) => type === "all" || m.type === type), [items, type]);
  const shelfCounts = useMemo(() => new Map<Shelf, number>(SHELVES.map((s) => [s, ofMedium.filter((m) => onShelf(m, s)).length])), [ofMedium]);
  const likedCount = useMemo(() => ofMedium.filter(isLiked).length, [ofMedium]);
  const gallery = useMemo(
    () => sortGallery(ofMedium.filter((m) => onShelf(m, shelf) && (!likedOnly || isLiked(m)) && matchesSearch(m, q)), sort),
    [ofMedium, shelf, likedOnly, q, sort],
  );
  // Resolve by id so the dialog re-renders with the live record after each transition.
  const viewing = viewingId ? (items.find((m) => m.id === viewingId) ?? null) : null;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 p-6">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Cinema</h1>
          <PhoneDock>
            <div className="flex items-center gap-2 max-md:contents">
              {/* Phone: an icon, so search, Filters and the adds share one line. */}
              <Button variant="outline" size={phone ? "icon-sm" : "sm"} aria-label={phone ? "Add with details" : undefined} title={phone ? "Add with details" : undefined} onClick={() => setAddOpen(true)}>
                {phone ? <Plus /> : <><SlidersHorizontal /> Add with details…</>}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Cinema lookup settings" title="Lookup settings" onClick={() => setLookupOpen(true)}>
                <Settings2 />
              </Button>
            </div>
          </PhoneDock>
        </div>
        <QuickAdd defaultType={type === "all" ? undefined : type} />
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
          <PhoneDock>
            {/* Desk: shelf and chips stay above the search (md:-order-1); phone: they and the sort go in the Filters sheet. */}
            <div className="flex flex-1 flex-wrap gap-2 max-md:contents">
              <Input className="flex-1 md:min-w-40 max-md:w-auto max-md:basis-36" placeholder="Search title, director, reason, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
              <PhoneFilters active={+(shelf !== "ALL") + +(type !== "all") + +likedOnly + +(sort !== "ADDED")}>
                <div className="grid w-full gap-2 md:-order-1">
                  <ShelfControl value={shelf} onChange={setShelf} counts={shelfCounts} />
                  <TypeChips value={type} onChange={setType} counts={typeCounts} liked={likedOnly} onLiked={setLikedOnly} likedCount={likedCount} />
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
      <AddWorkDialog open={addOpen} onOpenChange={setAddOpen} defaultType={type === "all" ? "movie" : type} />
      <EditWorkDialog item={editing} onClose={() => setEditing(null)} />
      <LookupSettingsDialog open={lookupOpen} onOpenChange={setLookupOpen} />
    </div>
  );
}
