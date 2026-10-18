import { pickLinked, type CommandDef } from "@lifeline/core";
import { NextPartDialog, partName } from "@lifeline/parts";
import { cinemaParts } from "./parts";
import { matchesSearch } from "./domain/browse";
import { Cover } from "./components/Cover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { Clapperboard, Eye, ListPlus, Plus, Settings2, SlidersHorizontal , StepForward } from "lucide-react";
import { AddWorkDialog } from "./components/AddWorkDialog";
import { QuickAdd } from "./components/QuickAdd";
import { LookupSettingsDialog } from "./components/LookupSettingsDialog";
import { MarkWatchedDialog } from "./components/MarkWatchedDialog";
import { PlaylistDialog } from "./components/PlaylistDialog";
import { APP_HREF } from "./constants";
import { WORK_TYPES, workType, type WorkTypeId } from "./domain/workTypes";
import { allWorks, quickAddWork, patchWork, useWorks } from "./data/repo";
import { finish } from "./domain/rules";
import { RATING_MAX } from "./domain/types";

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

/** "Watch next episode…" (ADR 0067): pick a work, its next Part is watched today. */
function NextPartCommandDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const works = useWorks();
  return (
    <NextPartDialog
      kit={cinemaParts}
      works={works}
      open={open}
      onOpenChange={onOpenChange}
      title="Watch the next episode"
      matches={matchesSearch}
      cover={(w) => <Cover item={w} className="shrink-0 rounded border" />}
      byline={(w) => w.creator}
    />
  );
}

export const cinemaCommands: CommandDef[] = [
  {
    id: "cinema.quick-add",
    fold: "culture.add",
    foldLabel: "Film or series",
    title: "Add movie…",
    keywords: ["movie", "series", "film", "watch", "cinema", "quick"],
    icon: Plus,
    dialog: QuickAddCommandDialog,
    capture: true,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "creator", label: "Creator", kind: "text", hint: "Director or creator." },
      { key: "type", label: "Kind", kind: "select", options: WORK_TYPES.map((t) => ({ value: t.id, label: t.label })), hint: `Defaults to ${WORK_TYPES[0].id}.` },
    ],
    async invoke(a) {
      const medium = ((a.type as WorkTypeId | undefined) ?? WORK_TYPES[0].id) as WorkTypeId;
      const title = (a.title as string).trim();
      const same = (await allWorks()).find((w) => w.type === medium && w.title.trim().toLowerCase() === title.toLowerCase());
      if (same) throw new Error(`“${same.title}” is already on the shelf; tell the user — nothing was changed`);
      const id = await quickAddWork({ medium, title, creator: a.creator as string | undefined });
      return { id, message: `${title} added (${workType(medium).wantLabel})` };
    },
  },
  {
    id: "cinema.mark-watched",
    fold: "culture.done",
    foldLabel: "Watched a film or series",
    title: "Mark watched…",
    keywords: ["watched", "seen", "done", "finish", "rate", "like", "movie", "series", "cinema", "log"],
    icon: Eye,
    dialog: MarkWatchedDialog,
    capture: true,
    args: [
      { key: "work", label: "Work", kind: "text", required: true, hint: "Id or exact title of a work already on the shelf." },
      { key: "rating", label: "Stars", kind: "number", hint: `Whole stars, 1–${RATING_MAX}.` },
      { key: "liked", label: "Liked", kind: "boolean" },
    ],
    async invoke(a) {
      const works = await allWorks();
      const id = pickLinked({ key: "work", label: "Work", kind: "link" }, a.work as string, works);
      const work = works.find((w) => w.id === id)!;
      const done = workType(work.type).engagement.DONE;
      if (work.engagement === "DONE") throw new Error(`“${work.title}” is already ${done}; tell the user — nothing was changed`);
      const stars = a.rating as number | undefined;
      if (stars !== undefined && (!Number.isInteger(stars) || stars < 1 || stars > RATING_MAX)) throw new Error(`Stars: a whole number from 1 to ${RATING_MAX}`);
      await patchWork(work, { ...finish(), ...(stars !== undefined ? { rating: stars } : {}), ...(a.liked !== undefined ? { liked: !!a.liked } : {}) });
      return { id, message: `${work.title}: ${done}${stars ? ` · ${"★".repeat(stars)}` : ""}${a.liked ? " · liked" : ""}` };
    },
  },
  {
    id: "cinema.next-part",
    fold: "culture.next",
    foldLabel: "Next episode",
    title: "Watch next episode…",
    keywords: ["watch", "next", "episode", "season", "series", "progress", "cinema", "+1"],
    icon: StepForward,
    dialog: NextPartCommandDialog,
    capture: true,
    args: [{ key: "work", label: "Work", kind: "text", required: true, hint: "Id or exact title of a series already on the shelf." }],
    async invoke(a) {
      const works = await allWorks();
      const id = pickLinked({ key: "work", label: "Work", kind: "link" }, a.work as string, works);
      const work = works.find((w) => w.id === id)!;
      const medium = workType(work.type).parts;
      if (!medium) throw new Error(`“${work.title}” has no parts; tell the user — nothing was changed`);
      const outcome = await cinemaParts.readNext(work);
      return { id, message: `${work.title}: ${partName(medium, outcome.pos)} watched${outcome.started ? " · started" : ""}${outcome.complete ? " · that was the last one — offer to mark it done" : ""}` };
    },
  },
  { id: "cinema.new-playlist", title: "New playlist…", keywords: ["playlist", "list", "collection", "cinema", "movies"], icon: ListPlus, dialog: PlaylistDialog },
  { id: "cinema.add", title: "Add movie with details", keywords: ["movie", "series", "film", "watch", "details", "cinema"], icon: SlidersHorizontal, dialog: AddWorkDialog },
  { id: "cinema.open", title: "Go to Cinema", keywords: ["cinema", "movies", "series", "films", "watching", "shelf"], icon: Clapperboard, run: ({ navigate }) => navigate(APP_HREF) },
  { id: "cinema.lookup-settings", title: "Cinema lookup settings…", keywords: ["cinema", "lookup", "metadata", "api", "key", "tmdb", "enrich", "posters"], icon: Settings2, dialog: LookupSettingsDialog },
];
