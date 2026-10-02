import type { CommandDef } from "@lifeline/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { Library as LibraryIcon, Plus, Settings2, SlidersHorizontal, UserPen } from "lucide-react";
import { ResolveAuthorsDialog } from "./components/ResolveAuthorsDialog";
import { AddWorkDialog } from "./components/AddWorkDialog";
import { QuickAdd } from "./components/QuickAdd";
import { LookupSettingsDialog } from "./components/LookupSettingsDialog";
import { APP_HREF } from "./constants";
import { WORK_TYPES, workType, type WorkTypeId } from "./domain/workTypes";
import { allWorks, quickAddWork } from "./data/repo";

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
  {
    id: "library.quick-add",
    title: "Add book…",
    keywords: ["book", "comic", "read", "library", "quick"],
    icon: Plus,
    dialog: QuickAddCommandDialog,
    capture: true,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "author", label: "Author", kind: "text", hint: "Author(s), comma-separated." },
      { key: "type", label: "Kind", kind: "select", options: WORK_TYPES.map((t) => ({ value: t.id, label: t.label })), hint: `Defaults to ${WORK_TYPES[0].id}.` },
    ],
    async invoke(a) {
      const medium = ((a.type as WorkTypeId | undefined) ?? WORK_TYPES[0].id) as WorkTypeId;
      const title = (a.title as string).trim();
      const same = (await allWorks()).find((w) => w.type === medium && w.title.trim().toLowerCase() === title.toLowerCase());
      if (same) throw new Error(`“${same.title}” is already on the shelf; tell the user — nothing was changed`);
      const id = await quickAddWork({ medium, title, author: a.author as string | undefined });
      return { id, message: `${title} added (${workType(medium).wantLabel})` };
    },
  },
  { id: "library.add", title: "Add book with details", keywords: ["book", "comic", "read", "details", "library"], icon: SlidersHorizontal, dialog: AddWorkDialog },
  { id: "library.open", title: "Go to Library", keywords: ["library", "books", "comics", "reading", "nightstand", "shelf"], icon: LibraryIcon, run: ({ navigate }) => navigate(APP_HREF) },
  { id: "library.resolve-authors", title: "Resolve authors…", keywords: ["library", "author", "authors", "open library", "resolve", "bibliography"], icon: UserPen, dialog: ResolveAuthorsDialog },
  { id: "library.lookup-settings", title: "Library lookup settings…", keywords: ["library", "lookup", "metadata", "api", "key", "comicvine", "google books", "enrich", "covers"], icon: Settings2, dialog: LookupSettingsDialog },
];
