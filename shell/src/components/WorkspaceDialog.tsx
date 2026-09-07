import { useState } from "react";
import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Separator,
  cn,
  toast,
} from "@lifeline/ui";
import {
  MODULES,
  createWorkspace,
  deleteWorkspace,
  documentsHeldBy,
  inhabitedModules,
  releaseWorkspaceDocuments,
  saveWorkspace,
  setCurrentWorkspace,
  useCurrentWorkspace,
  useWorkspaces,
  type WorkspaceRecord,
} from "@lifeline/core";
import { AlertTriangle, Lock, Plus, Trash2 } from "lucide-react";

/**
 * Creating, editing and deleting Workspaces (ADR 0047), and the separation
 * toggle (ADR 0048) with the warning that has to be at the toggle rather than
 * in a docs page: turning it on starts the Workspace empty, because separation
 * is a sealed box and not an overlay.
 */
export function WorkspaceDialog({
  open,
  onOpenChange,
  createFirst,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Open straight on the form — "New workspace" from the picker, and the fresh-account case. */
  createFirst?: boolean;
}) {
  const workspaces = useWorkspaces();
  const current = useCurrentWorkspace();
  const [editing, setEditing] = useState<WorkspaceRecord | "new" | null>(createFirst ? "new" : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {editing ? (
          <WorkspaceForm
            workspace={editing === "new" ? undefined : editing}
            onDone={() => (createFirst ? onOpenChange(false) : setEditing(null))}
            canDelete={workspaces.length > 1}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Workspaces</DialogTitle>
              <DialogDescription>
                A Workspace is a set of Modules. Which Modules it holds decides what its sidebar and phone bar list — never what the
                Schedule, the Vault or the palette can reach.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1">
              {workspaces.map((w) => (
                <button
                  key={w.id}
                  className={cn(
                    "hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-2 text-left text-sm",
                    w.id === current?.id && "bg-accent/40",
                  )}
                  onClick={() => setEditing(w)}
                >
                  {w.separated ? <Lock className="size-4 shrink-0" /> : <span className="size-4 shrink-0" />}
                  <span className="font-medium">{w.name}</span>
                  <span className="text-muted-foreground ml-auto text-xs">
                    {w.modules.length === MODULES.length ? "All modules" : `${w.modules.length} module${w.modules.length === 1 ? "" : "s"}`}
                  </span>
                </button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing("new")}>
                <Plus /> New workspace
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceForm({
  workspace,
  onDone,
  canDelete,
}: {
  workspace?: WorkspaceRecord;
  onDone: () => void;
  canDelete: boolean;
}) {
  const [name, setName] = useState(workspace?.name ?? "");
  const [modules, setModules] = useState<string[]>(workspace?.modules ?? inhabitedModules().map((m) => m.id));
  const [separated, setSeparated] = useState(!!workspace?.separated);
  const [busy, setBusy] = useState(false);
  const wasSeparated = !!workspace?.separated;

  function toggle(id: string) {
    setModules((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));
  }

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      if (workspace) await saveWorkspace({ ...workspace, name: name.trim(), modules, separated });
      else {
        const ws = await createWorkspace(name.trim(), modules, separated);
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
      ? `Delete “${workspace.name}”? Its ${held.length} document${held.length === 1 ? "" : "s"} become shared and its screens move to the first workspace. Nothing is deleted.`
      : `Delete “${workspace.name}”? Its screens move to the first workspace.`;
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
            The first three take the phone's bottom bar, in this order. A workspace holding everything is a worse phone than a focused one.
          </p>
          <div className="grid grid-cols-2 gap-1">
            {inhabitedModules().map((m) => (
              <label key={m.id} className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm">
                <Checkbox checked={modules.includes(m.id)} onCheckedChange={() => toggle(m.id)} />
                {m.title}
                {modules.indexOf(m.id) > -1 && modules.indexOf(m.id) < 3 && (
                  <span className="text-muted-foreground ml-auto text-[10px]">bar {modules.indexOf(m.id) + 1}</span>
                )}
              </label>
            ))}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Checkbox checked={separated} onCheckedChange={(v) => setSeparated(!!v)} />
            Keep this workspace's content separate
          </label>
          {separated && !wasSeparated && (
            <p className="text-destructive flex gap-2 rounded-md border border-current/30 p-2 text-xs">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                This workspace will start <strong>empty</strong>. Separation is a sealed box, not a filter: it will see only what is
                created in it from now on, and none of what you already have. Existing content crosses only by being moved, one
                document at a time or in bulk from a Base.
              </span>
            </p>
          )}
          {!separated && wasSeparated && (
            <p className="text-muted-foreground rounded-md border p-2 text-xs">
              New content will be shared again. What this workspace already holds stays held until you move it out.
            </p>
          )}
        </div>
      </div>

      <DialogFooter className="sm:justify-between">
        {workspace && canDelete ? (
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
