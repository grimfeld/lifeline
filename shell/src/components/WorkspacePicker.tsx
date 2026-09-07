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
import { Check, ChevronsUpDown, Lock, Settings2 } from "lucide-react";
import { WorkspaceDialog } from "./WorkspaceDialog";

/**
 * The Workspace picker (ADR 0047): name + chevron at the very top of the
 * sidebar, above the Frame switcher. Not a second segmented control — two
 * stacked segmented controls is a mess, and the number of Workspaces is
 * unbounded where the number of Frames is two.
 *
 * The phone header uses the same component (ADR 0049), which is why the
 * trigger is sized by its container rather than fixed.
 */
export function WorkspacePicker({ className }: { className?: string }) {
  const workspaces = useWorkspaces();
  const current = useCurrentWorkspace();
  const [manage, setManage] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!current) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className={cn("h-8 w-full justify-start gap-1.5 px-2 font-medium", className)}>
            {current.separated && <Lock className="text-muted-foreground size-3.5 shrink-0" />}
            <span className="truncate">{current.name}</span>
            <ChevronsUpDown className="text-muted-foreground ml-auto size-3.5 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
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
          <DropdownMenuItem onClick={() => setManage("")}>
            <Settings2 className="size-4" /> Manage workspaces…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {manage !== null && <WorkspaceDialog open onOpenChange={(o) => !o && setManage(null)} />}
    </>
  );
}
