import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@lifeline/ui";
import { Quote as QuoteIcon, Settings2, SlidersHorizontal } from "lucide-react";
import { useNavigate } from "react-router";
import { useQuotes } from "../data/quotes";
import { QUOTES_HREF } from "../linkable";
import { MEDIA_TYPES, mediaType, SLOTTED_TYPES, type MediaTypeId } from "../domain/mediaTypes";
import type { MediaItem } from "../domain/types";
import { freeSlots, nightstand } from "../domain/rules";
import { useMedia } from "../data/repo";
import { GALLERY_SORTS, matchesSearch, onShelf, SHELVES, shelfLabel, sortGallery, type GallerySort, type Shelf } from "../domain/browse";
import { AddMediaDialog } from "../components/AddMediaDialog";
import { MediaTile } from "../components/MediaTile";
import { MediaDetailDialog } from "../components/MediaDetailDialog";
import { EditMediaDialog } from "../components/MediaRow";
import { QuickAdd } from "../components/QuickAdd";
import { LookupSettingsDialog } from "../components/LookupSettingsDialog";
import { Cover } from "../components/Cover";

export type Medium = MediaTypeId | "all";

export function TypeChips({ value, onChange, counts }: { value: Medium; onChange: (v: Medium) => void; counts: Map<string, number> }) {
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

/** Segmented shelf control, labelled in the current medium's verbs, with counts. */
function ShelfControl({ value, onChange, medium, counts }: { value: Shelf; onChange: (s: Shelf) => void; medium: Medium; counts: Map<Shelf, number> }) {
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
          {shelfLabel(s, medium)}
          <span className="ml-1 tabular-nums opacity-60">{counts.get(s) ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

/** Compact Nightstand strip: one row per slotted medium — "Books · n/5", covers, empty-slot dashes. */
function NightstandStrip({ items, types, onOpen }: { items: MediaItem[]; types: MediaTypeId[]; onOpen: (m: MediaItem) => void }) {
  const rows = types.map((t) => ({ def: mediaType(t), slotted: nightstand(items, t), free: freeSlots(items, t) }));
  if (rows.length === 0) return null;
  return (
    <section className="grid gap-3 rounded-lg border p-3" aria-label="Nightstand">
      {rows.map(({ def, slotted, free }) => (
        <div key={def.id} className="grid gap-1.5">
          <h2 className="text-muted-foreground text-xs font-medium">
            {def.plural} · <span className="tabular-nums">{slotted.length}/{def.slotCount}</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {slotted.map((m) => (
              <button key={m.id} type="button" onClick={() => onOpen(m)} title={m.title} className="hover:bg-accent/50 flex w-16 flex-col items-center gap-1 rounded-md p-1 text-center">
                <Cover item={m} className="h-14 w-10" />
                <span className="line-clamp-2 w-full text-[10px] leading-tight">{m.title}</span>
              </button>
            ))}
            {free.map((s) => (
              <div key={s} className="text-muted-foreground flex h-14 w-10 items-center justify-center rounded border border-dashed text-xs" title={`Slot ${s} — empty`} aria-label={`Slot ${s} empty`}>
                —
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function emptyMessage(shelf: Shelf, medium: Medium): string {
  const want = shelfLabel("UNSTARTED", medium).toLowerCase(); // "to read", "to do"
  switch (shelf) {
    case "UNSTARTED":
      return `Nothing ${want} yet — add something above.`;
    case "IN_PROGRESS":
      return "Nothing in progress — start something from the shelf above.";
    case "DONE":
      return "Nothing done yet.";
    case "ABANDONED":
      return "Nothing dropped.";
    default:
      return "Nothing here yet — add something above.";
  }
}

export function MediaScreen() {
  const items = useMedia();
  const quoteCount = useQuotes().length;
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [editing, setEditing] = useState<MediaItem | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [type, setType] = useState<Medium>("all");
  const [shelf, setShelf] = useState<Shelf>("UNSTARTED");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<GallerySort>("ADDED");

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.type, (m.get(it.type) ?? 0) + 1);
    m.set("all", items.length);
    return m;
  }, [items]);

  const ofMedium = useMemo(() => items.filter((m) => type === "all" || m.type === type), [items, type]);
  const shelfCounts = useMemo(() => new Map<Shelf, number>(SHELVES.map((s) => [s, ofMedium.filter((m) => onShelf(m, s)).length])), [ofMedium]);
  const gallery = useMemo(() => sortGallery(ofMedium.filter((m) => onShelf(m, shelf)).filter((m) => matchesSearch(m, q)), sort), [ofMedium, shelf, q, sort]);
  // Resolve by id so the dialog re-renders with the live record after each transition.
  const viewing = viewingId ? (items.find((m) => m.id === viewingId) ?? null) : null;

  // Nightstand strip: only on the "to…"/in-progress shelves, only for slotted media (book when All).
  const stripTypes: MediaTypeId[] =
    shelf === "UNSTARTED" || shelf === "IN_PROGRESS"
      ? type === "all"
        ? SLOTTED_TYPES.filter((t) => t === "book" || (typeCounts.get(t) ?? 0) > 0)
        : SLOTTED_TYPES.includes(type)
          ? [type]
          : []
      : [];

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 p-6">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Media</h1>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(QUOTES_HREF)}>
              <QuoteIcon /> Quotes ({quoteCount})
            </Button>
            <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
              <SlidersHorizontal /> Add with details…
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Media lookup settings" title="Lookup settings" onClick={() => setLookupOpen(true)}>
              <Settings2 />
            </Button>
          </div>
        </div>
        <QuickAdd defaultType={type === "all" ? undefined : type} />
      </div>

      <div className="grid gap-2">
        <ShelfControl value={shelf} onChange={setShelf} medium={type} counts={shelfCounts} />
        <TypeChips value={type} onChange={setType} counts={typeCounts} />
        <div className="flex flex-wrap gap-2">
          <Input className="min-w-40 flex-1" placeholder="Search title, creator, reason, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
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

      {stripTypes.length > 0 && <NightstandStrip items={items} types={stripTypes} onOpen={(m) => setViewingId(m.id)} />}

      {gallery.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">{q.trim() ? "Nothing matches that search." : emptyMessage(shelf, type)}</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-4">
          {gallery.map((m) => (
            <MediaTile key={m.id} item={m} onOpen={(it) => setViewingId(it.id)} />
          ))}
        </div>
      )}

      <MediaDetailDialog item={viewing} all={items} onClose={() => setViewingId(null)} onEdit={setEditing} />
      <AddMediaDialog open={addOpen} onOpenChange={setAddOpen} defaultType={type === "all" ? "book" : type} />
      <EditMediaDialog item={editing} onClose={() => setEditing(null)} />
      <LookupSettingsDialog open={lookupOpen} onOpenChange={setLookupOpen} />
    </div>
  );
}
