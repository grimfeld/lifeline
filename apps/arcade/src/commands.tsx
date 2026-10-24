import { type CommandDef, type CommandDialogProps } from "@lifeline/core";
import { quickAddFromLine } from "@lifeline/parts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@lifeline/ui";
import { Gamepad2, Plus, Settings2, SlidersHorizontal } from "lucide-react";
import { AddWorkDialog } from "./components/AddWorkDialog";
import { QuickAdd } from "./components/QuickAdd";
import { LookupSettingsDialog } from "./components/LookupSettingsDialog";
import { APP_HREF } from "./constants";
import { WORK_TYPES, workType, type WorkTypeId } from "./domain/workTypes";
import { quickAddWork } from "./data/repo";

/** One-line quick add in a small dialog; closes as soon as something is added. */
function QuickAddCommandDialog({ open, onOpenChange, initial }: CommandDialogProps) {
  const line = quickAddFromLine(initial, WORK_TYPES);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a game</DialogTitle>
        </DialogHeader>
        <QuickAdd autoFocus defaultType={line.medium} initialText={line.text} onAdded={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export const arcadeCommands: CommandDef[] = [
  {
    id: "arcade.quick-add",
    fold: "culture.add",
    foldLabel: "Game",
    title: "Add game…",
    keywords: ["game", "play", "arcade", "quick"],
    icon: Plus,
    dialog: QuickAddCommandDialog,
    capture: true,
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "creator", label: "Creator", kind: "text", hint: "Developer." },
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
  { id: "arcade.add", title: "Add game with details", keywords: ["game", "play", "details", "arcade"], icon: SlidersHorizontal, dialog: AddWorkDialog },
  { id: "arcade.open", title: "Go to Arcade", keywords: ["arcade", "games", "playing", "shelf"], icon: Gamepad2, run: ({ navigate }) => navigate(APP_HREF) },
  { id: "arcade.lookup-settings", title: "Arcade lookup settings…", keywords: ["arcade", "lookup", "metadata", "api", "key", "rawg", "enrich", "covers"], icon: Settings2, dialog: LookupSettingsDialog },
];
