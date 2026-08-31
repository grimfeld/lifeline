import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, toast } from "@lifeline/ui";
import { ArrowDownToLine, BookOpenCheck, Check, MoreHorizontal, Pencil, Play, ShoppingCart, Square, Trash2, X } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { abandon, acquire, evict, finish, freeSlots, isBuySignal, promote, release, start, type Patch } from "../domain/rules";
import { deleteWork, patchWork } from "../data/repo";

/** Applies a transition patch to an item and toasts. */
export function useAct(item: Work) {
  return (label: string, patch: Patch) => () => {
    void patchWork(item, patch);
    toast.success(label);
  };
}

/**
 * The full transition set for one item, as a dropdown. Shared by the list row
 * and the detail dialog so both offer exactly the same actions.
 */
export function WorkActionsMenu({ item, all, onEdit, onDeleted, onOpenChange, trigger }: { item: Work; all: Work[]; onEdit: (m: Work) => void; onDeleted?: () => void; onOpenChange?: (open: boolean) => void; trigger?: React.ReactNode }) {
  const def = workType(item.type);
  const slotted = item.slot > 0;
  const free = freeSlots(all, item.type);
  const buy = isBuySignal(item);
  const reading = item.engagement === "IN_PROGRESS";
  const done = item.engagement === "DONE" || item.engagement === "ABANDONED";
  const act = useAct(item);

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <Button size="icon" variant="ghost" className="size-7 shrink-0">
            <MoreHorizontal />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {slotted ? (
          <>
            {buy && (
              <DropdownMenuItem onClick={act("Got it", acquire("OWNED"))}>
                <ShoppingCart /> Got it (owned)
              </DropdownMenuItem>
            )}
            {!reading && (
              <DropdownMenuItem onClick={act(`${def.engagement.IN_PROGRESS}…`, start())}>
                <Play /> {def.startVerb}
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={act("Slot freed", finish())}>
              <Check /> {def.finishVerb}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={act("Abandoned — slot freed", abandon())}>
              <X /> Abandon
            </DropdownMenuItem>
            <DropdownMenuItem onClick={act("Back to the backlog", evict())}>
              <Square /> Back to backlog
            </DropdownMenuItem>
          </>
        ) : (
          <>
            {!done && (
              <DropdownMenuItem disabled={free.length === 0} onClick={act(`Slot ${free[0]} taken`, promote(free[0]))}>
                <ArrowDownToLine /> Slot it{free.length === 0 ? " (full)" : ""}
              </DropdownMenuItem>
            )}
            {item.acquisition === "WANTED" && (
              <DropdownMenuItem onClick={act("Owned", acquire("OWNED"))}>
                <ShoppingCart /> Got it (owned)
              </DropdownMenuItem>
            )}
            {done && (
              <DropdownMenuItem onClick={act("Back to unstarted", { engagement: "UNSTARTED", finishedOn: "", startedOn: "" })}>
                <BookOpenCheck /> Mark {def.engagement.UNSTARTED.toLowerCase()} again
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        {item.acquisition !== "GONE" && (
          <DropdownMenuItem onClick={act("Gone", release())}>
            <X /> Gone (sold / returned / given away)
          </DropdownMenuItem>
        )}
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
  );
}
