import { useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  toast,
} from "@lifeline/ui";
import {
  canDeleteWorkspace,
  createWorkspace,
  deleteWorkspace,
  documentsHeldBy,
  inhabitedModules,
  isDefaultWorkspace,
  releaseWorkspaceDocuments,
  saveWorkspace,
  separatedWhenCreated,
  setCurrentWorkspace,
  useWorkspaces,
  type WorkspaceRecord,
} from "@lifeline/core";
import { AlertTriangle, Trash2 } from "lucide-react";

/**
 * Creating a Workspace (ADR 0047). There is no separation toggle (ADR 0057):
 * the first Workspace is the default and reads the shared content, every later
 * one is separated — and the warning that it starts empty sits right here,
 * because separation is a sealed box and not an overlay.
 *
 * Creating only. Listing and editing moved to `/settings` (ADR 0053), so that
 * the `workspaces` record has one front door — its Modules seed the Phone bar,
 * and editing the two in different places would couple them by a rule the user
 * cannot see. This stays a dialog because it is also the fresh-account
 * bootstrap, which runs when there is no page to stand on.
 */
export function WorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Retained for call sites; creating is now all this dialog does. */
  createFirst?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <WorkspaceForm onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function WorkspaceForm({
  workspace,
  onDone,
}: {
  workspace?: WorkspaceRecord;
  onDone: () => void;
}) {
  const workspaces = useWorkspaces();
  const [name, setName] = useState(workspace?.name ?? "");
  const [modules, setModules] = useState<string[]>(workspace?.modules ?? inhabitedModules().map((m) => m.id));
  const [busy, setBusy] = useState(false);
  // Not a choice (ADR 0057): the default reads the shared content, every
  // Workspace made after it is a separate world of its own.
  const separated = workspace ? !!workspace.separated : separatedWhenCreated(workspaces.length);
  const canDelete = !!workspace && canDeleteWorkspace(workspace, workspaces);
  // Unseparated but not the default: an older or duplicate Workspace that reads
  // the shared content alongside the default, and can go.
  const isDefault = !workspace || isDefaultWorkspace(workspace, workspaces);

  function toggle(id: string) {
    setModules((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (workspace) await saveWorkspace({ ...workspace, name: name.trim(), modules });
      else {
        const ws = await createWorkspace(name.trim(), modules);
        setCurrentWorkspace(ws.id);
      }
      onDone();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!workspace) return;
    const held = workspace.separated ? await documentsHeldBy(workspace.id) : [];
    const msg = held.length
      ? `Delete “${workspace.name}”? Its ${held.length} document${held.length === 1 ? "" : "s"} become shared and its screens move to the default workspace. Nothing is deleted.`
      : `Delete “${workspace.name}”? Its screens move to the default workspace.`;
    if (!confirm(msg)) return;
    setBusy(true);
    try {
      await deleteWorkspace(workspace.id, releaseWorkspaceDocuments);
      toast.success(held.length ? `“${workspace.name}” deleted — ${held.length} document${held.length === 1 ? "" : "s"} released` : `“${workspace.name}” deleted`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{workspace ? "Edit workspace" : "New workspace"}</DialogTitle>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ws-name">Name</Label>
          <Input id="ws-name" value={name} autoFocus placeholder="Work" onChange={(e) => setName(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Modules</Label>
          <p className="text-muted-foreground text-xs">
            Which Modules stand on this workspace's Rail. A new workspace's phone bar starts from these; rearrange it under Phone bar.
          </p>
          <div className="grid grid-cols-2 gap-1">
            {inhabitedModules().map((m) => (
              <label key={m.id} className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                <Checkbox checked={modules.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                {m.title}
              </label>
            ))}
          </div>
        </div>

        <Separator />

        {!separated ? (
          <p className="text-muted-foreground rounded-md border p-2 text-xs">
            {!workspace
              ? "Your first workspace is the default: it reads everything that is shared."
              : isDefault
                ? "The default workspace: it reads everything that is shared. It cannot be deleted — a deleted workspace's content comes back here."
                : "Reads everything that is shared, like the default, and holds nothing of its own. Deleting it loses no content; its screens move to the default."}
          </p>
        ) : workspace ? (
          <p className="text-muted-foreground rounded-md border p-2 text-xs">
            A separate world: this workspace sees only what it holds. Content crosses by being moved, and deleting the workspace releases what it holds to the default.
          </p>
        ) : (
          <p className="text-destructive flex gap-2 rounded-md border border-current/30 p-2 text-xs">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              A new workspace is a <strong>separate world</strong> and starts <strong>empty</strong>: it sees only what is created in it
              from now on, and none of what you already have. Existing content crosses only by being moved, one document at a time or in
              bulk from a Base.
            </span>
          </p>
        )}
      </div>

      <DialogFooter className="sm:justify-between">
        {canDelete ? (
          <Button variant="ghost" className="text-destructive" disabled={busy} onClick={() => void remove()}>
            <Trash2 /> Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button disabled={busy || !name.trim() || modules.length === 0} onClick={() => void save()}>
            Save
          </Button>
        </div>
      </DialogFooter>
    </>
  );
}
