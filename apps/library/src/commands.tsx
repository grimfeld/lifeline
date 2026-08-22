import type { CommandDef } from "@lifeline/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { Library as LibraryIcon, Plus, Settings2, SlidersHorizontal } from "lucide-react";
import { AddWorkDialog } from "./components/AddWorkDialog";
import { QuickAdd } from "./components/QuickAdd";
import { LookupSettingsDialog } from "./components/LookupSettingsDialog";
import { APP_HREF } from "./constants";

/** One-line quick add in a small dialog; closes as soon as something is added. */
function QuickAddCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a book or comic</DialogTitle>
        </DialogHeader>
        <QuickAdd autoFocus onAdded={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export const libraryCommands: CommandDef[] = [
  { id: "library.quick-add", title: "Add book…", keywords: ["book", "comic", "read", "library", "quick"], icon: Plus, dialog: QuickAddCommandDialog, capture: true },
  { id: "library.add", title: "Add book with details", keywords: ["book", "comic", "read", "details", "library"], icon: SlidersHorizontal, dialog: AddWorkDialog },
  { id: "library.open", title: "Go to Library", keywords: ["library", "books", "comics", "reading", "nightstand", "shelf"], icon: LibraryIcon, run: ({ navigate }) => navigate(APP_HREF) },
  { id: "library.lookup-settings", title: "Library lookup settings…", keywords: ["library", "lookup", "metadata", "api", "key", "comicvine", "google books", "enrich", "covers"], icon: Settings2, dialog: LookupSettingsDialog },
];
