import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, cn, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Tabs, TabsContent, TabsList, TabsTrigger } from "@lifeline/ui";
import { Plus } from "lucide-react";
import { MEDIA_TYPES, mediaType, type MediaTypeId } from "../domain/mediaTypes";
import type { MediaItem } from "../domain/types";
import { backlog, freeSlots, nightstand } from "../domain/rules";
import { useMedia } from "../data/repo";
import { AddMediaDialog } from "../components/AddMediaDialog";
import { EditMediaDialog, MediaRow } from "../components/MediaRow";

type Filter = "ALL" | "WANTED" | "OWNED_UNSTARTED" | "DONE" | "STUDIED" | "ABANDONED" | "GONE";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "Everything" },
  { value: "WANTED", label: "Wanted" },
  { value: "OWNED_UNSTARTED", label: "Owned but unstarted" },
  { value: "DONE", label: "Done" },
  { value: "STUDIED", label: "Studied" },
  { value: "ABANDONED", label: "Abandoned" },
  { value: "GONE", label: "Gone" },
];

function matches(m: MediaItem, f: Filter): boolean {
  switch (f) {
    case "ALL":
      return true;
    case "WANTED":
      return m.acquisition === "WANTED";
    case "OWNED_UNSTARTED":
      return m.acquisition === "OWNED" && m.engagement === "UNSTARTED";
    case "DONE":
      return m.engagement === "DONE";
    case "STUDIED":
      return m.studied;
    case "ABANDONED":
      return m.engagement === "ABANDONED";
    case "GONE":
      return m.acquisition === "GONE";
  }
}

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
  const [type, setType] = useState<MediaTypeId | "all">("all");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.type, (m.get(it.type) ?? 0) + 1);
    m.set("all", items.length);
    return m;
  }, [items]);

  const types = type === "all" ? MEDIA_TYPES.map((t) => t.id).filter((t) => (counts.get(t) ?? 0) > 0 || t === "book") : [type];

  const pool = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return backlog(items)
      .filter((m) => type === "all" || m.type === type)
      .filter((m) => matches(m, filter))
      .filter((m) => !needle || [m.title, m.creator, m.reason].some((s) => s.toLowerCase().includes(needle)))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [items, type, q, filter]);

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
        </TabsList>

        <TabsContent value="nightstand" className="grid gap-6 pt-4">
          {types.map((t) => (
            <NightstandSection key={t} type={t} items={items} onEdit={setEditing} />
          ))}
        </TabsContent>

        <TabsContent value="backlog" className="grid gap-3 pt-4">
          <div className="flex gap-2">
            <Input placeholder="Search title, creator, reason…" value={q} onChange={(e) => setQ(e.target.value)} />
            <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
      </Tabs>

      <AddMediaDialog open={addOpen} onOpenChange={setAddOpen} defaultType={type === "all" ? "book" : type} />
      <EditMediaDialog item={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
