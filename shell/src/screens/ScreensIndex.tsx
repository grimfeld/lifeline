import { useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input } from "@lifeline/ui";
import { newId, put, useCurrentWorkspace, useWorkspaceScreens, type UserScreen } from "@lifeline/core";
import { LayoutDashboard, Plus } from "lucide-react";

/**
 * `/screens` — the side door (ADR 0057): this Workspace's Screens, and the
 * place to make one. A Screen is the occasional page across Modules the user
 * arranges themself; the hand-written Module is the interface.
 */
export function ScreensIndex() {
  const screens = useWorkspaceScreens();
  const ws = useCurrentWorkspace();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  async function create() {
    if (!name.trim()) return;
    const id = newId();
    await put<UserScreen>("screens", {
      id,
      name: name.trim(),
      layout: [],
      sort: screens.length,
      // A Screen belongs to the Workspace it was made in (ADR 0047).
      workspace: ws?.id,
    });
    setName("");
    setOpen(false);
    navigate(`/screen/${id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Screens</h1>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus /> New screen
        </Button>
      </div>
      {screens.length === 0 ? (
        <p className="text-muted-foreground text-sm">No screens in this workspace. A Screen is a page of Cards you arrange yourself, across Modules.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {screens.map((s) => (
            <NavLink key={s.id} to={`/screen/${s.id}`} className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-3 py-3 text-sm">
              <LayoutDashboard className="size-5 shrink-0" />
              <span className="font-medium">{s.name}</span>
            </NavLink>
          ))}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>New screen</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Morning review"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void create()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void create()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
