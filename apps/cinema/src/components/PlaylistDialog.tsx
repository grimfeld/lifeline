import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Textarea, toast } from "@lifeline/ui";
import type { Playlist } from "../domain/types";
import { addPlaylist, patchPlaylist } from "../data/repo";

/** New or edit: title, blurb (the body), ranked. Nothing about its works — those are added from the works themselves. */
export function PlaylistDialog({ open, onOpenChange, playlist, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; playlist?: Playlist | null; onCreated?: (id: string) => void }) {
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [ranked, setRanked] = useState(false);
  useEffect(() => {
    if (!open) return;
    setTitle(playlist?.title ?? "");
    setBlurb(playlist?.body ?? "");
    setRanked(playlist?.ranked ?? false);
  }, [open, playlist]);

  async function save() {
    const t = title.trim();
    if (!t) return void toast.error("A playlist needs a name");
    if (playlist) {
      await patchPlaylist(playlist, { title: t, body: blurb, ranked });
      toast.success("Playlist saved");
    } else {
      const id = await addPlaylist({ title: t, body: blurb, ranked });
      toast.success(`${t} created`);
      onCreated?.(id);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{playlist ? "Edit playlist" : "New playlist"}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="playlist-title">Name</Label>
            <Input id="playlist-title" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Films for a rainy Sunday" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="playlist-blurb">Blurb</Label>
            <Textarea id="playlist-blurb" rows={3} value={blurb} onChange={(e) => setBlurb(e.target.value)} placeholder="What holds these together (optional)" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={ranked} onCheckedChange={(v) => setRanked(v === true)} /> Ranked — show the order as numbers
          </label>
          <DialogFooter>
            <Button type="submit">{playlist ? "Save" : "Create"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
