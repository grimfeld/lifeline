import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn, Input, PhoneDock, PhoneFilters, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@lifeline/ui";
import { Settings2, SlidersHorizontal } from "lucide-react";
import { SLOTTED_TYPES, WORK_TYPES, workType, type WorkTypeId } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { freeSlots, nightstand } from "../domain/rules";
import { useWorks } from "../data/repo";
import { GALLERY_SORTS, matchesSearch, onShelf, SHELVES, shelfLabel, sortGallery, type GallerySort, type Shelf } from "../domain/browse";
import { AddWorkDialog } from "../components/AddWorkDialog";
import { WorkTile } from "../components/WorkTile";
import { WorkDetailDialog } from "../components/WorkDetailDialog";
import { EditWorkDialog, WorkRow } from "../components/WorkRow";
import { QuickAdd } from "../components/QuickAdd";
import { LookupSettingsDialog } from "../components/LookupSettingsDialog";
import { useAuthorNames } from "../components/AuthorNames";

export type Medium = WorkTypeId | "all";

function TypeChips({ value, onChange, counts }: { value: Medium; onChange: (v: Medium) => void; counts: Map<string, number> }) {
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
    </div>
  );
}

/** Segmented shelf control, labelled in the medium's verbs, with counts. */
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

/** The Nightstand tab: one section per slotted medium — the slotted rows, then the empty slots. */
function NightstandTab({ items, onEdit }: { items: Work[]; onEdit: (w: Work) => void }) {
  return (
    <div className="grid gap-4">
      {SLOTTED_TYPES.map((t) => {
        const def = workType(t);
        const slotted = nightstand(items, t);
        const free = freeSlots(items, t);
        return (
          <section key={t} className="grid gap-2" aria-label={`${def.plural} nightstand`}>
            <h2 className="text-muted-foreground text-sm font-medium">
              {def.plural} · <span className="tabular-nums">{slotted.length}/{def.slotCount}</span>
            </h2>
            {slotted.length === 0 && <p className="text-muted-foreground text-sm">No {def.plural.toLowerCase()} slotted — pick something from the gallery.</p>}
            <div className="grid gap-2">
              {slotted.map((m) => (
                <WorkRow key={m.id} item={m} all={items} onEdit={onEdit} />
              ))}
            </div>
            {free.length > 0 && slotted.length > 0 && (
              <p className="text-muted-foreground text-xs">
                {free.length} free slot{free.length === 1 ? "" : "s"}.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function emptyMessage(shelf: Shelf): string {
  switch (shelf) {
    case "UNSTARTED":
      return "Nothing to read yet — add something above.";
    case "IN_PROGRESS":
      return "Nothing in progress — start something from the shelf.";
    case "DONE":
      return "Nothing read yet.";
    case "ABANDONED":
      return "Nothing dropped.";
    default:
      return "The Library is empty — add your first book above.";
  }
}

/** The Library (ADR 0024): the Gallery you land on, the Nightstand one tab away. */
export function LibraryScreen() {
  const items = useWorks();
  const authorNames = useAuthorNames();
  const [addOpen, setAddOpen] = useState(false);
  const [lookupOpen, setLookupOpen] = useState(false);
  const [editing, setEditing] = useState<Work | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [type, setType] = useState<Medium>("all");
  const [shelf, setShelf] = useState<Shelf>("ALL");
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
  const gallery = useMemo(() => sortGallery(ofMedium.filter((m) => onShelf(m, shelf)).filter((m) => matchesSearch(m, q, authorNames)), sort), [ofMedium, shelf, q, sort, authorNames]);
  // Resolve by id so the dialog re-renders with the live record after each transition.
  const viewing = viewingId ? (items.find((m) => m.id === viewingId) ?? null) : null;
  const slottedCount = items.filter((m) => m.slot > 0).length;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-5 p-6">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <PhoneDock row className="justify-end">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <SlidersHorizontal /> Add with details…
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Library lookup settings" title="Lookup settings" onClick={() => setLookupOpen(true)}>
                <Settings2 />
              </Button>
            </div>
          </PhoneDock>
        </div>
        <QuickAdd defaultType={type === "all" ? undefined : type} />
      </div>

      <Tabs defaultValue="gallery">
        <PhoneDock row order={1}>
          <TabsList>
            <TabsTrigger value="gallery">Gallery</TabsTrigger>
            <TabsTrigger value="nightstand">
              Nightstand <span className="ml-1 tabular-nums opacity-60">{slottedCount}</span>
            </TabsTrigger>
          </TabsList>
        </PhoneDock>

        <TabsContent value="gallery" className="grid gap-3 pt-2">
          <PhoneDock row>
            {/* Desk: shelf and chips stay above the search (md:-order-1); phone: they and the sort go in the Filters sheet. */}
            <div className="flex flex-1 flex-wrap gap-2">
              <Input className="min-w-40 flex-1" placeholder="Search title, author, reason, #tag…" value={q} onChange={(e) => setQ(e.target.value)} />
              <PhoneFilters active={+(shelf !== "ALL") + +(type !== "all") + +(sort !== "ADDED")}>
                <div className="grid w-full gap-2 md:-order-1">
                  <ShelfControl value={shelf} onChange={setShelf} medium={type} counts={shelfCounts} />
                  <TypeChips value={type} onChange={setType} counts={typeCounts} />
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
              <CardContent className="text-muted-foreground p-8 text-center text-sm">{q.trim() ? "Nothing matches that search." : emptyMessage(shelf)}</CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-x-3 gap-y-4">
              {gallery.map((m) => (
                <WorkTile key={m.id} item={m} all={items} onOpen={(it) => setViewingId(it.id)} onEdit={setEditing} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="nightstand" className="pt-2">
          <NightstandTab items={items} onEdit={setEditing} />
        </TabsContent>
      </Tabs>

      <WorkDetailDialog item={viewing} all={items} onClose={() => setViewingId(null)} onEdit={setEditing} />
      <AddWorkDialog open={addOpen} onOpenChange={setAddOpen} defaultType={type === "all" ? "book" : type} />
      <EditWorkDialog item={editing} onClose={() => setEditing(null)} />
      <LookupSettingsDialog open={lookupOpen} onOpenChange={setLookupOpen} />
    </div>
  );
}
