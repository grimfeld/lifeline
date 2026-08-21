import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@lifeline/ui";
import { ArchiveRestore, DoorOpen, Eye, Hammer, Plus } from "lucide-react";
import { ART_FORMS } from "../domain/artForms";
import type { Artwork, Exhibition } from "../domain/types";
import { STATE_LABELS, canHang, canReopen, canTakeDown, hanging, roomsOf } from "../domain/rules";
import { addExhibition, deleteExhibition, hangExhibition, reopenExhibition, takeDownExhibition, useArtists, useArtworks, useExhibitions, useRooms } from "../data/repo";
import { ArtworkImage } from "../components/ArtworkImage";
import { ArtworkDialog } from "../components/ArtworkDialog";
import { exhibitionHref } from "../constants";

type FormFilter = Artwork["type"] | "all";

function FormChips({ value, onChange, counts }: { value: FormFilter; onChange: (v: FormFilter) => void; counts: Map<string, number> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {[{ id: "all" as const, label: "All" }, ...ART_FORMS.map((f) => ({ id: f.id, label: f.plural }))].map((f) => (
        <button
          key={f.id}
          type="button"
          aria-pressed={value === f.id}
          className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", value === f.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent")}
          onClick={() => onChange(f.id)}
        >
          {f.label}
          {counts.get(f.id) ? <span className="ml-1 opacity-70">{counts.get(f.id)}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** A hung show at the entrance: its first image as the poster, room and work counts. */
function Poster({ show, image, roomCount, workCount, onEnter }: { show: Exhibition; image: Artwork | undefined; roomCount: number; workCount: number; onEnter: () => void }) {
  return (
    <button type="button" className="hover:bg-accent/50 flex w-44 flex-col gap-2 rounded-lg border p-3 text-left" onClick={onEnter}>
      {image ? <ArtworkImage artwork={image} size="tile" /> : <div className="bg-muted text-muted-foreground flex aspect-square w-full items-center justify-center rounded text-xs">No image yet</div>}
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{show.title}</div>
        <div className="text-muted-foreground text-xs">
          {roomCount} room{roomCount === 1 ? "" : "s"} · {workCount} work{workCount === 1 ? "" : "s"}
          {show.hungOn ? ` · since ${show.hungOn}` : ""}
        </div>
      </div>
    </button>
  );
}

function NewExhibitionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  async function create() {
    const t = name.trim();
    if (!t) return;
    const id = await addExhibition(t);
    setName("");
    onOpenChange(false);
    navigate(exhibitionHref(id));
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New exhibition</DialogTitle>
        </DialogHeader>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Dutch light" autoFocus onKeyDown={(e) => e.key === "Enter" && void create()} />
        <DialogFooter>
          <Button type="button" disabled={!name.trim()} onClick={() => void create()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The Museum: the entrance (hung shows as posters), the Holdings (the whole
 * permanent collection as an image grid) and every exhibition with its
 * lifecycle verbs (ADR 0022).
 */
export function MuseumScreen() {
  const navigate = useNavigate();
  const artworks = useArtworks();
  const artists = useArtists();
  const shows = useExhibitions();
  const rooms = useRooms();
  const [adding, setAdding] = useState(false);
  const [newShow, setNewShow] = useState(false);
  const [editing, setEditing] = useState<Artwork | null>(null);
  const [formFilter, setFormFilter] = useState<FormFilter>("all");
  const [search, setSearch] = useState("");

  const byId = useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);
  const artistOf = useMemo(() => new Map(artists.map((a) => [a.id, a.title])), [artists]);
  const hung = hanging(shows);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of artworks) m.set(a.type, (m.get(a.type) ?? 0) + 1);
    return m;
  }, [artworks]);

  const grid = useMemo(() => {
    const q = search.trim().toLowerCase();
    return artworks
      .filter((a) => (formFilter === "all" || a.type === formFilter))
      .filter((a) => !q || a.title.toLowerCase().includes(q) || (artistOf.get(a.artistId) ?? "").toLowerCase().includes(q))
      .sort((a, b) => b.addedOn.localeCompare(a.addedOn) || a.title.localeCompare(b.title));
  }, [artworks, formFilter, search, artistOf]);

  function showMeta(e: Exhibition) {
    const rs = roomsOf(rooms, e.id);
    const workCount = new Set(rs.flatMap((r) => r.artworkIds)).size;
    const image = rs.flatMap((r) => r.artworkIds).map((id) => byId.get(id)).find((a) => a?.imageUrl);
    return { rs, workCount, image };
  }

  return (
    <div className="grid content-start gap-6 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Museum</h1>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setNewShow(true)}>
            <DoorOpen className="size-4" /> New exhibition
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> Add artwork
          </Button>
        </div>
      </header>

      <section aria-label="Now hanging" className="grid gap-2">
        <h2 className="text-muted-foreground text-sm font-medium">Now hanging</h2>
        {hung.length === 0 ? (
          <p className="text-muted-foreground text-sm">The walls are bare — hang an exhibition.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {hung.map((e) => {
              const { rs, workCount, image } = showMeta(e);
              return <Poster key={e.id} show={e} image={image} roomCount={rs.length} workCount={workCount} onEnter={() => navigate(exhibitionHref(e.id))} />;
            })}
          </div>
        )}
      </section>

      <Tabs defaultValue="holdings">
        <TabsList>
          <TabsTrigger value="holdings">Holdings</TabsTrigger>
          <TabsTrigger value="exhibitions">Exhibitions</TabsTrigger>
        </TabsList>
        <TabsContent value="holdings" className="grid gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <FormChips value={formFilter} onChange={setFormFilter} counts={counts} />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title or artist…" className="ml-auto h-8 w-56" />
          </div>
          {grid.length === 0 ? (
            <p className="text-muted-foreground text-sm">{artworks.length === 0 ? "The Holdings are empty — add your first artwork." : "Nothing matches."}</p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-3 gap-y-4">
              {grid.map((a) => (
                <li key={a.id}>
                  <button type="button" className="hover:bg-accent/50 grid w-full gap-1 rounded-md p-1.5 text-left" onClick={() => setEditing(a)}>
                    <ArtworkImage artwork={a} size="tile" />
                    <span className="flex items-start justify-between gap-1">
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{a.title}</span>
                        <span className="text-muted-foreground block truncate text-[10px]">{[artistOf.get(a.artistId), a.year].filter(Boolean).join(", ")}</span>
                      </span>
                      {a.seen && <Eye className="text-muted-foreground mt-0.5 size-3 shrink-0" aria-label="Seen in person" />}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
        <TabsContent value="exhibitions" className="grid gap-2 pt-2">
          {shows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No exhibitions yet — curation starts with one.</p>
          ) : (
            <ul className="grid gap-1">
              {[...shows]
                .sort((a, b) => a.state.localeCompare(b.state) || a.title.localeCompare(b.title))
                .map((e) => {
                  const { rs, workCount } = showMeta(e);
                  return (
                    <li key={e.id} className="hover:bg-accent/50 flex items-center gap-2 rounded-md border px-2 py-1.5">
                      <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => navigate(exhibitionHref(e.id))}>
                        <span className="truncate text-sm font-medium">{e.title}</span>
                        <Badge variant={e.state === "HANGING" ? "default" : "outline"} className="shrink-0 text-[10px]">
                          {STATE_LABELS[e.state]}
                        </Badge>
                        <span className="text-muted-foreground shrink-0 text-xs">
                          {rs.length} room{rs.length === 1 ? "" : "s"} · {workCount} work{workCount === 1 ? "" : "s"}
                        </span>
                      </button>
                      {canHang(e.state) && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void hangExhibition(e.id)}>
                          Hang
                        </Button>
                      )}
                      {canTakeDown(e.state) && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void takeDownExhibition(e.id)}>
                          Take down
                        </Button>
                      )}
                      {canReopen(e.state) && (
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" title="Back to preparation" onClick={() => void reopenExhibition(e.id)}>
                          <Hammer className="size-3" /> Reopen
                        </Button>
                      )}
                      {e.state !== "HANGING" && (
                        <Button size="sm" variant="ghost" className="text-destructive h-7 px-2 text-xs" onClick={() => void deleteExhibition(e.id)}>
                          Delete
                        </Button>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
          <p className="text-muted-foreground flex items-center gap-1 text-xs">
            <ArchiveRestore className="size-3" /> Taking a show down archives it, rooms intact; re-hang it any time.
          </p>
        </TabsContent>
      </Tabs>

      <ArtworkDialog open={adding} onOpenChange={setAdding} />
      <ArtworkDialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} artwork={editing} />
      <NewExhibitionDialog open={newShow} onOpenChange={setNewShow} />
    </div>
  );
}
