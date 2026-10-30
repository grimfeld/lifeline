import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Tip, toast } from "@lifeline/ui";
import { BookOpenCheck, Check, MoreHorizontal, Play, ShoppingCart, Trash2, X } from "lucide-react";
import { workType } from "../domain/workTypes";
import type { Work } from "../domain/types";
import { abandon, acquire, finish, release, start, type Patch } from "../domain/rules";
import { deleteWork, patchWork } from "../data/repo";

/** Applies a transition patch to an item and toasts. A plain function, not a hook: the detail dialog calls it after its early return. */
export function actOn(item: Work) {
  return (label: string, patch: Patch) => () => {
    void patchWork(item, patch);
    toast.success(label);
  };
}

/**
 * The full transition set for one item, as a dropdown. Shared by the page
 * and the Peek so both offer exactly the same actions.
 */
export function WorkActionsMenu({ item, onDeleted, trigger }: { item: Work; onDeleted?: () => void; trigger?: React.ReactNode }) {
  const def = workType(item.type);
  const reading = item.engagement === "IN_PROGRESS";
  const done = item.engagement === "DONE" || item.engagement === "ABANDONED";
  const act = actOn(item);

  return (
    <DropdownMenu>
      {trigger ? (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      ) : (
        <Tip label="More actions">
          <DropdownMenuTrigger asChild>
            <Button size="icon-sm" variant="ghost" className="shrink-0">
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
        </Tip>
      )}
      <DropdownMenuContent align="end">
        {!reading && !done && (
          <DropdownMenuItem onClick={act(`${def.engagement.IN_PROGRESS}…`, start())}>
            <Play /> {def.startVerb}
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
        {item.acquisition === "WANTED" && (
          <DropdownMenuItem onClick={act("Got it (owned)", acquire("OWNED"))}>
            <ShoppingCart /> Got it (owned)
          </DropdownMenuItem>
        )}
        {done && (
          <DropdownMenuItem onClick={act("Back to unstarted", { engagement: "UNSTARTED", finishedOn: "", startedOn: "" })}>
            <BookOpenCheck /> Mark {def.engagement.UNSTARTED.toLowerCase()} again
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {item.acquisition !== "GONE" && (
          <DropdownMenuItem onClick={act("Gone", release())}>
            <X /> Gone (sold / returned / given away)
          </DropdownMenuItem>
        )}
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
