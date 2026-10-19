import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, toast } from "@lifeline/ui";
import { ArrowDown, ArrowLeft, ArrowUp, ListVideo, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Playlist, Work } from "../domain/types";
import { byTitle, moveInPlaylist, removeFromPlaylist, worksOf } from "../domain/playlist";
import { deletePlaylist, patchPlaylist, usePlaylists } from "../data/repo";
import { Cover } from "./Cover";
import { MarksGlance } from "./Marks";
import { PlaylistDialog } from "./PlaylistDialog";

/** The Playlists tab (CONTEXT.md, ADR 0035): every playlist, or the one you opened. */
export function PlaylistsTab({ items, onOpenWork }: { items: Work[]; onOpenWork: (w: Work) => void }) {
  const playlists = usePlaylists();
  const byId = useMemo(() => new Map(items.map((w) => [w.id, w])), [items]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Playlist | null>(null);
  // Resolve by id so the page re-renders with the live record after each change.
  const open = openId ? (playlists.find((p) => p.id === openId) ?? null) : null;

  if (open) {
    return (
      <PlaylistPage
        playlist={open}
        byId={byId}
        onBack={() => setOpenId(null)}
        onOpenWork={onOpenWork}
        onEdit={() => {
          setEditing(open);
          setDialogOpen(true);
        }}
        onDeleted={() => setOpenId(null)}
        dialog={<PlaylistDialog open={dialogOpen} onOpenChange={setDialogOpen} playlist={editing} />}
      />
    );
  }

  const sorted = [...playlists].sort(byTitle);
  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">Hand-picked, in your order. Add works from their ⋯ menu.</p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus /> New playlist
        </Button>
      </div>
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">No playlists yet — make the first one.</CardContent>
        </Card>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {sorted.map((p) => {
            const works = worksOf(p, byId);
            return (
              <li key={p.id}>
                <button type="button" onClick={() => setOpenId(p.id)} className="hover:bg-accent/50 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors">
                  <div className="flex shrink-0 -space-x-3">
                    {works.slice(0, 4).map((w) => (
                      <Cover key={w.id} item={w} className="h-14 w-10 rounded border shadow-sm" />
                    ))}
                    {works.length === 0 && (
                      <div className="bg-muted text-muted-foreground flex h-14 w-10 items-center justify-center rounded border">
                        <ListVideo className="size-4" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{p.title}</div>
                    <div className="text-muted-foreground truncate text-xs">
                      {works.length} {works.length === 1 ? "work" : "works"}
                      {p.ranked ? " · ranked" : ""}
                      {p.body ? ` · ${p.body.split("\n")[0]}` : ""}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <PlaylistDialog open={dialogOpen} onOpenChange={setDialogOpen} playlist={editing} onCreated={setOpenId} />
    </div>
  );
}

/** One playlist: blurb, then its works in order, with up/down/remove and a rank number when ranked. */
function PlaylistPage({ playlist, byId, onBack, onOpenWork, onEdit, onDeleted, dialog }: { playlist: Playlist; byId: Map<string, Work>; onBack: () => void; onOpenWork: (w: Work) => void; onEdit: () => void; onDeleted: () => void; dialog: React.ReactNode }) {
  const works = worksOf(playlist, byId);
  return (
    <div className="grid gap-3">
      <div className="flex items-start gap-2">
        <Button size="icon-sm" variant="ghost" aria-label="All playlists" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg leading-tight font-semibold">{playlist.title}</h2>
          <div className="text-muted-foreground text-xs">
            {works.length} {works.length === 1 ? "work" : "works"}
            {playlist.ranked ? " · ranked" : ""}
          </div>
          {playlist.body && <p className="text-muted-foreground mt-1 text-sm whitespace-pre-wrap">{playlist.body}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" aria-label="Playlist actions">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                void deletePlaylist(playlist.id);
                toast.success(`${playlist.title} deleted`);
                onDeleted();
              }}
            >
              <Trash2 /> Delete playlist
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <PlaylistWorks playlist={playlist} works={works} onOpenWork={onOpenWork} />
      {dialog}
    </div>
  );
}

/** A playlist's works in order, with up/down/remove (its guarded list moves only through these) and a rank number when ranked. Shared by its page and its Peek. */
export function PlaylistWorks({ playlist, works, onOpenWork }: { playlist: Playlist; works: Work[]; onOpenWork: (w: Work) => void }) {
  const move = (w: Work, delta: -1 | 1) => void patchPlaylist(playlist, { workIds: moveInPlaylist(playlist.workIds, w.id, delta) });
  return (
    <>
      {works.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground p-8 text-center text-sm">Nothing here yet — open a work and choose “Add to playlist…”.</CardContent>
        </Card>
      ) : (
        <ol className="grid gap-1.5">
          {works.map((w, i) => (
            <li key={w.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
              {playlist.ranked && <span className="text-muted-foreground w-6 shrink-0 text-right text-sm tabular-nums">{i + 1}</span>}
              <button type="button" className="shrink-0" onClick={() => onOpenWork(w)}>
                <Cover item={w} className="h-14 w-10 rounded border shadow-sm" />
              </button>
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenWork(w)}>
                <div className="truncate text-sm font-medium">{w.title}</div>
                <div className="text-muted-foreground flex items-center gap-2 truncate text-xs">
                  <span className="truncate">
                    {w.creator}
                    {w.creator && w.year ? " · " : ""}
                    {w.year || ""}
                  </span>
                  <MarksGlance item={w} />
                </div>
              </button>
              <div className="flex shrink-0 items-center">
                <Button size="icon-sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(w, -1)}>
                  <ArrowUp className={cn(i === 0 && "opacity-30")} />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Move down" disabled={i === works.length - 1} onClick={() => move(w, 1)}>
                  <ArrowDown className={cn(i === works.length - 1 && "opacity-30")} />
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label="Remove from playlist" onClick={() => void patchPlaylist(playlist, { workIds: removeFromPlaylist(playlist.workIds, w.id) })}>
                  <X />
                </Button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
