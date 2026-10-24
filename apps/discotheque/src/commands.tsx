import { initialText, pickLinked, type CommandDef, type CommandDialogProps } from "@lifeline/core";
import { NextPartDialog, partName, quickAddFromLine } from "@lifeline/parts";
import { discothequeParts } from "./parts";
import { matchesSearch } from "./domain/browse";
import { Cover } from "./components/Cover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { Disc3, Headphones, ListPlus, Plus, SlidersHorizontal, Sparkles , StepForward } from "lucide-react";
import { AddWorkDialog } from "./components/AddWorkDialog";
import { QuickAdd } from "./components/QuickAdd";
import { EnrichDialog } from "./components/EnrichDialog";
import { MarkListenedDialog } from "./components/MarkListenedDialog";
import { PlaylistDialog } from "./components/PlaylistDialog";
import { APP_HREF } from "./constants";
import { WORK_TYPES, workType, type WorkTypeId } from "./domain/workTypes";
import { allWorks, quickAddWork, patchWork, useWorks } from "./data/repo";
import { finish } from "./domain/rules";
import { RATING_MAX } from "./domain/types";

/** One-line quick add in a small dialog; closes as soon as something is added. */
function QuickAddCommandDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const line = quickAddFromLine(initial, WORK_TYPES);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add an album</DialogTitle>
        </DialogHeader>
        <QuickAdd autoFocus defaultType={line.medium} initialText={line.text} onAdded={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** "Hear next track…" (ADR 0074): pick a work, its next Part is heard today. */
function NextPartCommandDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const works = useWorks();
  return (
    <NextPartDialog
      kit={discothequeParts}
      works={works}
      open={open}
      onOpenChange={onOpenChange}
      initialQuery={initialText(initial, "work")}
      title="Hear the next track"
      matches={matchesSearch}
      cover={(w) => <Cover item={w} className="shrink-0 rounded border" />}
      byline={(w) => w.creator}
    />
  );
}

export const discothequeCommands: CommandDef[] = [
  {
    id: "discotheque.quick-add",
    fold: "culture.add",
    foldLabel: "Album",
    title: "Add album…",
    keywords: ["album", "music", "listen", "discotheque", "quick"],
    icon: Plus,
    dialog: QuickAddCommandDialog,
    capture: true,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "creator", label: "Creator", kind: "text", hint: "Artist." },
      { key: "type", label: "Kind", kind: "select", options: WORK_TYPES.map((t) => ({ value: t.id, label: t.label })), hint: `Defaults to ${WORK_TYPES[0]!.id}.` },
    ],
    returnsDocument: true,
    async invoke(a) {
      const medium = ((a.type as WorkTypeId | undefined) ?? WORK_TYPES[0]!.id) as WorkTypeId;
      const title = (a.title as string).trim();
      const { id, twin } = await quickAddWork({ medium, title, creator: a.creator as string | undefined });
      if (twin) throw new Error(`“${twin.title}” is already on the shelf; tell the user — nothing was changed`);
      return { id, message: `${title} added (${workType(medium).wantLabel})` };
    },
  },
  {
    id: "discotheque.mark-listened",
    fold: "culture.done",
    foldLabel: "Listened to an album",
    title: "Mark listened…",
    keywords: ["listened", "heard", "done", "finish", "rate", "like", "album", "music", "discotheque", "log"],
    icon: Headphones,
    dialog: MarkListenedDialog,
    capture: true,
    args: [
      { key: "work", label: "Work", kind: "text", required: true, hint: "Id or exact title of a work already on the shelf." },
      { key: "rating", label: "Stars", kind: "number", hint: `Whole stars, 1–${RATING_MAX}.` },
      { key: "liked", label: "Liked", kind: "boolean" },
    ],
    returnsDocument: true,
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
    id: "discotheque.next-part",
    fold: "culture.next",
    foldLabel: "Next track",
    title: "Hear next track…",
    keywords: ["listen", "hear", "next", "track", "disc", "album", "progress", "discotheque", "+1"],
    icon: StepForward,
    dialog: NextPartCommandDialog,
    capture: true,
    args: [{ key: "work", label: "Work", kind: "text", required: true, hint: "Id or exact title of an album already on the shelf." }],
    returnsDocument: true,
    async invoke(a) {
      const works = await allWorks();
      const id = pickLinked({ key: "work", label: "Work", kind: "link" }, a.work as string, works);
      const work = works.find((w) => w.id === id)!;
      const medium = workType(work.type).parts;
      if (!medium) throw new Error(`“${work.title}” has no parts; tell the user — nothing was changed`);
      const outcome = await discothequeParts.readNext(work);
      return { id, message: `${work.title}: ${partName(medium, outcome.pos)} heard${outcome.started ? " · started" : ""}${outcome.complete ? " · that was the last one — offer to mark it done" : ""}` };
    },
  },
  { id: "discotheque.new-playlist", title: "New playlist…", keywords: ["playlist", "list", "collection", "discotheque", "albums"], icon: ListPlus, dialog: PlaylistDialog },
  { id: "discotheque.add", title: "Add album with details", keywords: ["album", "music", "listen", "details", "discotheque"], icon: SlidersHorizontal, dialog: AddWorkDialog },
  { id: "discotheque.open", title: "Go to Discotheque", keywords: ["discotheque", "music", "albums", "listening", "shelf"], icon: Disc3, run: ({ navigate }) => navigate(APP_HREF) },
  { id: "discotheque.enrich", title: "Enrich albums from MusicBrainz…", keywords: ["discotheque", "music", "lookup", "metadata", "enrich", "covers", "musicbrainz"], icon: Sparkles, dialog: EnrichDialog },
];
