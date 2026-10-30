import { useState, type ReactNode } from "react";
import { Button } from "@lifeline/ui";
import { ListPlus } from "lucide-react";
import { Section } from "./WorkPage";

/**
 * The Playlists a work sits in, on its Work page, with the way to add it to
 * more. The App hands in the titles and its own "Add to playlist" dialog.
 */
export function PlaylistsSection({ titles, addDialog }: { titles: string[]; addDialog: (open: boolean, onOpenChange: (open: boolean) => void) => ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Section title="Playlists">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {titles.length > 0 ? <span className="min-w-0 break-words">In {titles.join(", ")}</span> : <span className="text-muted-foreground">In no playlist yet.</span>}
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
          <ListPlus /> Add to playlist…
        </Button>
      </div>
      {addDialog(open, setOpen)}
    </Section>
  );
}
