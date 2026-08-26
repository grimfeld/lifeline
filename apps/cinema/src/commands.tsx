import type { CommandDef } from "@lifeline/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { Clapperboard, Eye, ListPlus, Plus, Settings2, SlidersHorizontal } from "lucide-react";
import { AddWorkDialog } from "./components/AddWorkDialog";
import { QuickAdd } from "./components/QuickAdd";
import { LookupSettingsDialog } from "./components/LookupSettingsDialog";
import { MarkWatchedDialog } from "./components/MarkWatchedDialog";
import { PlaylistDialog } from "./components/PlaylistDialog";
import { APP_HREF } from "./constants";

/** One-line quick add in a small dialog; closes as soon as something is added. */
function QuickAddCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a movie or series</DialogTitle>
        </DialogHeader>
        <QuickAdd autoFocus onAdded={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export const cinemaCommands: CommandDef[] = [
  { id: "cinema.quick-add", title: "Add movie…", keywords: ["movie", "series", "film", "watch", "cinema", "quick"], icon: Plus, dialog: QuickAddCommandDialog, capture: true },
  { id: "cinema.mark-watched", title: "Mark watched…", keywords: ["watched", "seen", "done", "finish", "rate", "like", "movie", "series", "cinema", "log"], icon: Eye, dialog: MarkWatchedDialog, capture: true },
  { id: "cinema.new-playlist", title: "New playlist…", keywords: ["playlist", "list", "collection", "cinema", "movies"], icon: ListPlus, dialog: PlaylistDialog },
  { id: "cinema.add", title: "Add movie with details", keywords: ["movie", "series", "film", "watch", "details", "cinema"], icon: SlidersHorizontal, dialog: AddWorkDialog },
  { id: "cinema.open", title: "Go to Cinema", keywords: ["cinema", "movies", "series", "films", "watching", "shelf"], icon: Clapperboard, run: ({ navigate }) => navigate(APP_HREF) },
  { id: "cinema.lookup-settings", title: "Cinema lookup settings…", keywords: ["cinema", "lookup", "metadata", "api", "key", "tmdb", "enrich", "posters"], icon: Settings2, dialog: LookupSettingsDialog },
];
