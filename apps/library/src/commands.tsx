import { pickLinked, type CommandDef } from "@lifeline/core";
import { NextPartDialog, partName } from "@lifeline/parts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { Library as LibraryIcon, Plus, Settings2, SlidersHorizontal, StepForward, UserPen } from "lucide-react";
import { ResolveAuthorsDialog } from "./components/ResolveAuthorsDialog";
import { AddWorkDialog } from "./components/AddWorkDialog";
import { QuickAdd } from "./components/QuickAdd";
import { LookupSettingsDialog } from "./components/LookupSettingsDialog";
import { APP_HREF } from "./constants";
import { WORK_TYPES, workType, type WorkTypeId } from "./domain/workTypes";
import { allWorks, quickAddWork, useAuthorIndex, useWorks } from "./data/repo";
import { libraryParts } from "./parts";
import { matchesSearch } from "./domain/browse";
import { Cover } from "./components/Cover";
import type { Work } from "./domain/types";

/** One-line quick add in a small dialog; closes as soon as something is added. */
function QuickAddCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a book, comic or manga</DialogTitle>
        </DialogHeader>
        <QuickAdd autoFocus onAdded={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** "Next chapter of…" (ADR 0074): pick a work, its next Part is read today. */
function NextPartCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const works = useWorks();
  const authors = useAuthorIndex();
  const names = (w: Work) => w.authors.map((id) => authors.get(id)?.title ?? "").filter(Boolean);
  return (
    <NextPartDialog
      kit={libraryParts}
      works={works}
      open={open}
      onOpenChange={onOpenChange}
      title="Read the next part"
      matches={(w, q) => matchesSearch(w, q, names)}
      cover={(w) => <Cover item={w} className="shrink-0 rounded border" />}
      byline={(w) => `${workType(w.type).label}${names(w).length ? ` · ${names(w).join(", ")}` : ""}`}
    />
  );
}

export const libraryCommands: CommandDef[] = [
  {
    id: "library.quick-add",
    fold: "culture.add",
    foldLabel: "Book, comic or manga",
    title: "Add book…",
    keywords: ["book", "comic", "manga", "read", "library", "quick"],
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
  {
    id: "library.next-part",
    fold: "culture.next",
    foldLabel: "Next chapter or issue",
    title: "Read next part…",
    keywords: ["read", "next", "chapter", "issue", "manga", "comic", "book", "progress", "library", "+1"],
    icon: StepForward,
    dialog: NextPartCommandDialog,
    capture: true,
    args: [{ key: "work", label: "Work", kind: "text", required: true, hint: "Id or exact title of a book, comic or manga already on the shelf." }],
    async invoke(a) {
      const works = await allWorks();
      const id = pickLinked({ key: "work", label: "Work", kind: "link" }, a.work as string, works);
      const work = works.find((w) => w.id === id)!;
      const medium = workType(work.type).parts;
      const outcome = await libraryParts.readNext(work);
      return { id, message: `${work.title}: ${partName(medium, outcome.pos)} read${outcome.started ? " · started" : ""}${outcome.complete ? " · that was the last one — offer to mark it done" : ""}` };
    },
  },
  { id: "library.add", title: "Add book with details", keywords: ["book", "comic", "manga", "read", "details", "library"], icon: SlidersHorizontal, dialog: AddWorkDialog },
  { id: "library.open", title: "Go to Library", keywords: ["library", "books", "comics", "manga", "reading", "nightstand", "shelf"], icon: LibraryIcon, run: ({ navigate }) => navigate(APP_HREF) },
  { id: "library.resolve-authors", title: "Resolve authors…", keywords: ["library", "author", "authors", "open library", "resolve", "bibliography"], icon: UserPen, dialog: ResolveAuthorsDialog },
  { id: "library.lookup-settings", title: "Library lookup settings…", keywords: ["library", "lookup", "metadata", "api", "key", "comicvine", "google books", "enrich", "covers"], icon: Settings2, dialog: LookupSettingsDialog },
];
