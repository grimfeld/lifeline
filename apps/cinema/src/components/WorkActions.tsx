import { useState } from "react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, toast } from "@lifeline/ui";
import { BookOpenCheck, Check, Eye, ListPlus, MoreHorizontal, Pencil, Play, Trash2, X } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { abandon, finish, start, unfinish, type Patch } from "../domain/rules";
import { deleteWork, patchWork } from "../data/repo";
import { AddToPlaylistDialog } from "./AddToPlaylistDialog";

/** Applies a transition patch to an item and toasts. */
export function useAct(item: Work) {
  return (label: string, patch: Patch) => () => {
    void patchWork(item, patch);
    toast.success(label);
  };
}

/**
 * The full transition set for one item, as a dropdown. Shared by the detail
 * dialog and the cards so both offer exactly the same actions.
 */
export function WorkActionsMenu({ item, onEdit, onDeleted, onOpenChange, trigger }: { item: Work; onEdit: (m: Work) => void; onDeleted?: () => void; onOpenChange?: (open: boolean) => void; trigger?: React.ReactNode }) {
  const def = workType(item.type);
  const reading = item.engagement === "IN_PROGRESS";
  const done = item.engagement === "DONE" || item.engagement === "ABANDONED";
  const act = useAct(item);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  return (
    <>
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button size="icon" variant="ghost" className="size-7 shrink-0">
            <MoreHorizontal />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {!reading && !done && (
          <DropdownMenuItem onClick={act(`${def.engagement.IN_PROGRESS}…`, start())}>
            <Play /> {def.startVerb}
          </DropdownMenuItem>
        )}
        {item.engagement !== "DONE" && (
          <DropdownMenuItem onClick={act(def.engagement.DONE, finish())}>
            <Eye /> Mark {def.engagement.DONE.toLowerCase()}
          </DropdownMenuItem>
        )}
        {reading && (
          <>
            <DropdownMenuItem onClick={act(def.engagement.DONE, finish())}>
              <Check /> {def.finishVerb}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={act("Abandoned", abandon())}>
              <X /> Abandon
            </DropdownMenuItem>
          </>
        )}
        {done && (
          <DropdownMenuItem onClick={act("Back to unstarted", { ...unfinish(), startedOn: "" })}>
            <BookOpenCheck /> Mark {def.engagement.UNSTARTED.toLowerCase()} again
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setPlaylistOpen(true)}>
          <ListPlus /> Add to playlist…
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(item)}>
          <Pencil /> Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void deleteWork(item.id);
            toast.success("Deleted");
            onDeleted?.();
          }}
        >
          <Trash2 /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AddToPlaylistDialog item={item} open={playlistOpen} onOpenChange={setPlaylistOpen} />
    </>
  );
}
