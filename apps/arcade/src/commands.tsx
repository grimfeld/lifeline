import type { CommandDef } from "@lifeline/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { Gamepad2, Plus, Settings2, SlidersHorizontal } from "lucide-react";
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
          <DialogTitle>Add a game</DialogTitle>
        </DialogHeader>
        <QuickAdd autoFocus onAdded={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export const arcadeCommands: CommandDef[] = [
  {
    id: "arcade.quick-add",
    title: "Add game…",
    keywords: ["game", "play", "arcade", "quick"],
    icon: Plus,
    dialog: QuickAddCommandDialog,
    capture: true,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "creator", label: "Creator", kind: "text", hint: "Developer." },
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
  { id: "arcade.add", title: "Add game with details", keywords: ["game", "play", "details", "arcade"], icon: SlidersHorizontal, dialog: AddWorkDialog },
  { id: "arcade.open", title: "Go to Arcade", keywords: ["arcade", "games", "playing", "shelf"], icon: Gamepad2, run: ({ navigate }) => navigate(APP_HREF) },
  { id: "arcade.lookup-settings", title: "Arcade lookup settings…", keywords: ["arcade", "lookup", "metadata", "api", "key", "rawg", "enrich", "covers"], icon: Settings2, dialog: LookupSettingsDialog },
];
