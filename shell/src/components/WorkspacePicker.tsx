import { useState } from "react";
import { useNavigate } from "react-router";
import {
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@lifeline/ui";
import { setCurrentWorkspace, useCurrentWorkspace, useWorkspaces } from "@lifeline/core";
import { Check, ChevronsUpDown, Lock, Plus, Settings2 } from "lucide-react";
import { WorkspaceDialog } from "./WorkspaceDialog";

/**
 * The Workspace picker (ADR 0047): the top cell of the Rail (`compact`, ADR
 * 0057), and name + chevron in the phone's header.
 *
 * The phone header uses the same component (ADR 0049), which is why the
 * trigger is sized by its container rather than fixed.
 */
export function WorkspacePicker({ className, compact = false }: { className?: string; compact?: boolean }) {
  const workspaces = useWorkspaces();
  const current = useCurrentWorkspace();
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  /**
   * No Workspace yet — a fresh account, before the first pull has told us
   * whether the server has one (ADR 0047's bootstrap). Never render nothing:
   * an empty header is indistinguishable from a broken one, and this is the
   * only control that can make a Workspace, so hiding it is a dead end.
   */
  if (!current) {
    return (
      <>
        {compact ? (
          <Button variant="outline" size="icon" className={cn("size-9", className)} title="Setting up… — make a workspace" onClick={() => setCreating(true)}>
            <Plus className="text-muted-foreground size-4" />
          </Button>
        ) : (
          <Button variant="ghost" className={cn("h-8 w-full justify-start gap-1.5 px-2", className)} onClick={() => setCreating(true)}>
            <span className="text-muted-foreground truncate">Setting up…</span>
            <Plus className="text-muted-foreground ml-auto size-3.5 shrink-0" />
          </Button>
        )}
        {creating && <WorkspaceDialog open createFirst onOpenChange={(o) => !o && setCreating(false)} />}
      </>
    );
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {compact ? (
            // The Rail's top cell (ADR 0057): the Workspace as its initial.
            <Button variant="outline" size="icon" className={cn("size-9 text-sm font-semibold", className)} title={`Workspace: ${current.name}`}>
              {current.name.trim().charAt(0).toUpperCase() || "?"}
            </Button>
          ) : (
            <Button variant="ghost" className={cn("h-8 w-full justify-start gap-1.5 px-2 font-medium", className)}>
              {current.separated && <Lock className="text-muted-foreground size-3.5 shrink-0" />}
              <span className="truncate">{current.name}</span>
              <ChevronsUpDown className="text-muted-foreground ml-auto size-3.5 shrink-0" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side={compact ? "right" : "bottom"} className="w-56">
          {workspaces.map((w) => (
            <DropdownMenuItem
              key={w.id}
              onClick={() => {
                if (w.id === current.id) return;
                setCurrentWorkspace(w.id);
                // A Workspace's Screens are its own, so the Screen we are on is
                // very likely not in the one we just moved to.
                navigate("/");
              }}
            >
              {w.separated ? <Lock className="size-4" /> : <span className="size-4" />}
              <span className="truncate">{w.name}</span>
              {w.id === current.id && <Check className="ml-auto size-4" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          {/* Creating is the common errand and gets its own row: reaching it
              through "Manage workspaces…" made it three taps on a phone, where
              this picker is the primary navigation gesture. */}
          <DropdownMenuItem onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New workspace
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/settings")}>
            <Settings2 className="size-4" /> Settings…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {creating && <WorkspaceDialog open createFirst onOpenChange={(o) => !o && setCreating(false)} />}
    </>
  );
}
