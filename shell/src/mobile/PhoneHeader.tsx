import { useLocation, useNavigate } from "react-router";
import { Button, cn } from "@lifeline/ui";
import { DASHBOARD_FRAME, VAULT_FRAME, frameOfPath } from "@lifeline/core";
import { LayoutDashboard, NotebookText } from "lucide-react";
import { WorkspacePicker } from "../components/WorkspacePicker";
import { lastLocation } from "../components/FrameSwitcher";

/**
 * The phone's header (ADR 0049): the Workspace picker and the Frame toggle.
 *
 * Both are here rather than in the bar because the bar's middle belongs to the
 * Modules. You do not switch machines from the dock — and the Frame crossing,
 * which ADR 0045's amendment spent a slot on one release ago, keeps its
 * visibility here instead of falling back into the ☰ drawer, which is the dead
 * end that amendment exists to prevent.
 */
export function PhoneHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const frame = frameOfPath(location.pathname);
  const inVault = frame === VAULT_FRAME;
  const other = inVault ? DASHBOARD_FRAME : VAULT_FRAME;
  const OtherIcon = inVault ? LayoutDashboard : NotebookText;

  return (
    <header className="bg-background flex shrink-0 items-center gap-1 border-b px-2 py-1 md:hidden">
      <div className="min-w-0 flex-1">
        <WorkspacePicker />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className={cn("gap-1.5 px-2 text-xs", inVault && "text-foreground")}
        title={inVault ? "Go to the Dashboard" : "Go to the Vault"}
        onClick={() => navigate(lastLocation(other))}
      >
        <OtherIcon className="size-4" />
        {inVault ? "Dashboard" : "Vault"}
      </Button>
    </header>
  );
}
