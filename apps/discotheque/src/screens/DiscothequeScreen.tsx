import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { SlidersHorizontal, Sparkles } from "lucide-react";
import type { Work } from "../domain/types";
import { useWorks } from "../data/repo";
import { GALLERY_SORTS, matchesSearch, onShelf, SHELVES, shelfLabel, sortGallery, type GallerySort, type Shelf } from "../domain/browse";
import { AddWorkDialog } from "../components/AddWorkDialog";
import { WorkTile } from "../components/WorkTile";
import { WorkDetailDialog } from "../components/WorkDetailDialog";
import { EditWorkDialog } from "../components/WorkRow";
import { QuickAdd } from "../components/QuickAdd";
import { EnrichDialog } from "../components/EnrichDialog";

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
          {shelfLabel(s, "music")}
          <span className="ml-1 tabular-nums opacity-60">{counts.get(s) ?? 0}</span>
        </button>
      ))}
    </div>
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
          <h1 className="text-2xl font-semibold tracking-tight">Discotheque</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <SlidersHorizontal /> Add with details…
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Enrich from MusicBrainz" title="Enrich from MusicBrainz" onClick={() => setLookupOpen(true)}>
              <Sparkles />
            </Button>
          </div>
        </div>
        <QuickAdd />
      </div>

      <div className="grid gap-2">
        <ShelfControl value={shelf} onChange={setShelf} counts={shelfCounts} />
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-40 flex-1" placeholder="Search album, artist, reason, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
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
        </div>
      </div>

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
      <AddWorkDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditWorkDialog item={editing} onClose={() => setEditing(null)} />
      <EnrichDialog open={lookupOpen} onOpenChange={setLookupOpen} />
    </div>
  );
}
