import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  toast,
} from "@lifeline/ui";
import { moveDocumentsToWorkspace, useCurrentWorkspace, useWorkspaces } from "@lifeline/core";
import { Check, Lock } from "lucide-react";

/**
 * Moving Documents between Workspaces (ADR 0048) — the only way content
 * crosses a separation boundary, and the reason it ships with separation
 * rather than after it: a sealed box you cannot put anything into is a box you
 * cannot use.
 *
 * Offered wherever a Document is: in bulk from a Base's selection, and singly
 * from a Document's own menu. The destinations are the separated Workspaces
 * plus "Shared", which is where every unseparated Workspace reads from.
 */
export function MoveToWorkspaceDialog({
  ids,
  open,
  onOpenChange,
  onMoved,
}: {
  ids: string[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onMoved?: () => void;
}) {
  const workspaces = useWorkspaces();
  const current = useCurrentWorkspace();
  const [busy, setBusy] = useState(false);
  const currentScope = current?.separated ? current.id : "";

  const destinations = [
    { id: "", name: "Shared", hint: "Visible in every workspace that is not separated", separated: false },
    ...workspaces
      .filter((w) => w.separated)
      .map((w) => ({ id: w.id, name: w.name, hint: "Visible only in this workspace", separated: true })),
  ];

  async function move(to: string) {
    setBusy(true);
    try {
      await moveDocumentsToWorkspace(ids, to);
      const name = destinations.find((d) => d.id === to)?.name ?? "";
      toast.success(`${ids.length} document${ids.length === 1 ? "" : "s"} moved to ${name}`);
      onMoved?.();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not move");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Move {ids.length} document{ids.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription>
            A document lives in exactly one place. Moving it out of here means it stops being visible here.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          {destinations.map((d) => (
            <button
              key={d.id || "shared"}
              disabled={busy || d.id === currentScope}
              className="hover:bg-accent/50 flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm disabled:opacity-50"
              onClick={() => void move(d.id)}
            >
              {d.separated ? <Lock className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
              <span className="flex flex-col">
                <span className="font-medium">{d.name}</span>
                <span className="text-muted-foreground text-xs">{d.hint}</span>
              </span>
              {d.id === currentScope && <Check className="ml-auto size-4" />}
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
