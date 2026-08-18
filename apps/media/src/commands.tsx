import type { CommandDef } from "@lifeline/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { BookMarked, Plus, SlidersHorizontal } from "lucide-react";
import { AddMediaDialog } from "./components/AddMediaDialog";
import { QuickAdd } from "./components/QuickAdd";

function AddMediaCommandDialog(props: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return <AddMediaDialog {...props} />;
}

/** One-line quick add in a small dialog; closes as soon as something is added. */
function QuickAddCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add media</DialogTitle>
        </DialogHeader>
        <QuickAdd autoFocus onAdded={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export const mediaCommands: CommandDef[] = [
  { id: "media.quick-add", title: "Add media…", keywords: ["book", "movie", "series", "album", "game", "comic", "read", "watch", "quick"], icon: Plus, dialog: QuickAddCommandDialog },
  { id: "media.add", title: "Add media with details", keywords: ["book", "movie", "series", "album", "game", "comic", "read", "watch", "details"], icon: SlidersHorizontal, dialog: AddMediaCommandDialog },
  { id: "media.open", title: "Go to Media", keywords: ["media", "books", "reading", "nightstand", "shelf"], icon: BookMarked, run: ({ navigate }) => navigate("/app/media") },
];
