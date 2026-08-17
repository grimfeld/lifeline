import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, cn, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@lifeline/ui";
import { Plus } from "lucide-react";
import { MEDIA_TYPES, mediaType, type MediaTypeId } from "../domain/mediaTypes";
import type { MediaItem } from "../domain/types";
import { backlog, freeSlots, nightstand } from "../domain/rules";
import { useMedia } from "../data/repo";
import { GALLERY_SORTS, matchesSearch, matchesStatus, sortGallery, STATUS_FILTERS, type GallerySort, type StatusFilter } from "../domain/browse";
import { AddMediaDialog } from "../components/AddMediaDialog";
import { MediaTile } from "../components/MediaTile";
import { MediaDetailDialog } from "../components/MediaDetailDialog";
import { EditMediaDialog, MediaRow } from "../components/MediaRow";

function TypeChips({ value, onChange, counts }: { value: MediaTypeId | "all"; onChange: (v: MediaTypeId | "all") => void; counts: Map<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[{ id: "all" as const, label: "All" }, ...MEDIA_TYPES.map((t) => ({ id: t.id, label: t.plural }))].map((t) => (
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
    </div>
  );
}

function NightstandSection({ type, items, onEdit }: { type: MediaTypeId; items: MediaItem[]; onEdit: (m: MediaItem) => void }) {
  const def = mediaType(type);
  const slotted = nightstand(items, type);
  const free = freeSlots(items, type);
  return (
    <section className="grid gap-2">
      <h2 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
        {def.plural}
        <Badge variant="secondary">
          {slotted.length}/{def.slotCount}
        </Badge>
        {free.length === 0 && <span className="text-xs">full</span>}
      </h2>
      {slotted.map((m) => (
        <MediaRow key={m.id} item={m} all={items} onEdit={onEdit} />
      ))}
      {free.map((s) => (
        <div key={s} className="text-muted-foreground rounded-lg border border-dashed px-3 py-2 text-xs">
          Slot {s} — empty
        </div>
      ))}
      {free.length === 0 && (
        <p className="text-muted-foreground text-xs">Every slot is taken. {def.finishVerb} something or abandon it — those are the only two ways to make room.</p>
      )}
    </section>
  );
}

export function MediaScreen() {
  const items = useMedia();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [type, setType] = useState<MediaTypeId | "all">("all");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("ALL");
  const [sort, setSort] = useState<GallerySort>("ADDED");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.type, (m.get(it.type) ?? 0) + 1);
    m.set("all", items.length);
    return m;
  }, [items]);

  const types = type === "all" ? MEDIA_TYPES.map((t) => t.id).filter((t) => (counts.get(t) ?? 0) > 0 || t === "book") : [type];

  // Search + status filter apply to both the Backlog list and the Gallery.
  const narrowed = useMemo(
    () => items.filter((m) => type === "all" || m.type === type).filter((m) => matchesStatus(m, filter)).filter((m) => matchesSearch(m, q)),
    [items, type, q, filter],
  );
  const pool = useMemo(() => backlog(narrowed).sort((a, b) => a.title.localeCompare(b.title)), [narrowed]);
  const gallery = useMemo(() => sortGallery(narrowed, sort), [narrowed, sort]);
  // Resolve by id so the dialog re-renders with the live record after each transition.
  const viewing = viewingId ? (items.find((m) => m.id === viewingId) ?? null) : null;

  const filterControls = (
    <div className="flex gap-2">
      <Input placeholder="Search title, creator, reason…" value={q} onChange={(e) => setQ(e.target.value)} />
      <Select value={filter} onValueChange={(v) => setFilter(v as StatusFilter)}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((f) => (
            <SelectItem key={f.value} value={f.value}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
        <Button onClick={() => setAddOpen(true)}>
          <Plus /> Add
        </Button>
      </div>
      <TypeChips value={type} onChange={setType} counts={counts} />

      <Tabs defaultValue="nightstand">
        <TabsList>
          <TabsTrigger value="nightstand">Nightstand</TabsTrigger>
          <TabsTrigger value="backlog">Backlog ({backlog(items).filter((m) => type === "all" || m.type === type).length})</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
        </TabsList>

        <TabsContent value="nightstand" className="grid gap-6 pt-4">
          {types.map((t) => (
            <NightstandSection key={t} type={t} items={items} onEdit={setEditing} />
          ))}
        </TabsContent>

        <TabsContent value="backlog" className="grid gap-3 pt-4">
          {filterControls}
          {pool.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground p-8 text-center text-sm">Nothing here. The Backlog is the unranked pool the Nightstand is filled from.</CardContent>
            </Card>
          ) : (
            <div className="grid gap-2">
              {pool.map((m) => (
                <MediaRow key={m.id} item={m} all={items} onEdit={setEditing} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="gallery" className="grid gap-3 pt-4">
          <div className="flex flex-wrap gap-2">
            <div className="min-w-0 flex-1">{filterControls}</div>
            <Select value={sort} onValueChange={(v) => setSort(v as GallerySort)}>
              <SelectTrigger className="w-44">
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
          </div>
          {gallery.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground p-8 text-center text-sm">Nothing to show. The Gallery is everything you track — Nightstand and Backlog — as covers.</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-4">
              {gallery.map((m) => (
                <MediaTile key={m.id} item={m} onOpen={(it) => setViewingId(it.id)} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <MediaDetailDialog item={viewing} all={items} onClose={() => setViewingId(null)} onEdit={setEditing} />
      <AddMediaDialog open={addOpen} onOpenChange={setAddOpen} defaultType={type === "all" ? "book" : type} />
      <EditMediaDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
