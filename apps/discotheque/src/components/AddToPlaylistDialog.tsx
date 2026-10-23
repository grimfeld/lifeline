import { useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogHeader, DialogTitle, Input, toast } from "@lifeline/ui";
import { Plus } from "lucide-react";
import type { Work } from "../domain/types";
import { addToPlaylist, byTitle, removeFromPlaylist } from "../domain/playlist";
import { addPlaylist, patchPlaylist, usePlaylists } from "../data/repo";

/**
 * "Add to playlist…": every playlist as a checkbox — ticking writes at once,
 * no Save — plus a one-line "New playlist" that creates it with this work in it.
 */
export function AddToPlaylistDialog({ item, open, onOpenChange }: { item: Work; open: boolean; onOpenChange: (o: boolean) => void }) {
  const playlists = [...usePlaylists()].sort(byTitle);
  const [name, setName] = useState("");

  async function create() {
    const t = name.trim();
    if (!t) return;
    await addPlaylist({ title: t, body: "", ranked: false, workIds: [item.id] });
    setName("");
    toast.success(`${t} created — ${item.title} added`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to playlist</DialogTitle>
        </DialogHeader>
        <div className="text-muted-foreground -mt-2 truncate text-sm">{item.title}</div>
        {playlists.length > 0 ? (
          <ul className="grid max-h-72 gap-1 overflow-y-auto">
            {playlists.map((p) => {
              const inIt = p.workIds.includes(item.id);
              return (
                <li key={p.id}>
                  <label className="hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                    <Checkbox checked={inIt} onCheckedChange={(v) => void patchPlaylist(p, { workIds: v === true ? addToPlaylist(p.workIds, item.id) : removeFromPlaylist(p.workIds, item.id) })} />
                    <span className="truncate">{p.title}</span>
                    <span className="text-muted-foreground ml-auto text-xs tabular-nums">{p.workIds.length}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">No playlists yet — name the first one below.</p>
        )}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <Input aria-label="New playlist name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New playlist…" className="text-sm" />
          <Button type="submit" size="sm" variant="outline" disabled={!name.trim()}>
            <Plus /> Create
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
