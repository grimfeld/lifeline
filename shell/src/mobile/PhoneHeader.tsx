import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Button, Sheet, SheetContent, SheetTitle, cn } from "@lifeline/ui";
import { DASHBOARD_FRAME, VAULT_FRAME, frameOfPath, frames } from "@lifeline/core";
import { LayoutDashboard, Menu, NotebookText } from "lucide-react";
import { WorkspacePicker } from "../components/WorkspacePicker";
import { Sidebar } from "../components/Sidebar";
import { SyncBadge } from "../components/SyncBadge";
import { FrameSwitcher, lastLocation } from "../components/FrameSwitcher";

/**
 * The phone's header: **☰ · the Workspace picker · the Frame toggle**.
 *
 * `☰` is here rather than in the bar (ADR 0053), which frees the slot the
 * drawer used to hold and puts the menu where a phone's menu goes. The two
 * switchers keep the places ADR 0049 gave them: you do not switch machines
 * from the dock, and the Vault crossing stays visible rather than falling back
 * into the drawer, which is the dead end ADR 0045's amendment exists to
 * prevent.
 *
 * The drawer lives here too, since the button that opens it does.
 */
export function PhoneHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const frame = frameOfPath(location.pathname);
  const inVault = frame === VAULT_FRAME;
  const other = inVault ? DASHBOARD_FRAME : VAULT_FRAME;
  const OtherIcon = inVault ? LayoutDashboard : NotebookText;

  const ws = frames().find((w) => w.id === frame);
  const FrameSidebar = frame !== DASHBOARD_FRAME ? ws?.sidebar : undefined;

  // Any tap that navigates closes the drawer. A frame sidebar is not made of
  // links — the Vault's tree, search hits and tags are buttons that navigate —
  // so watching the location is the only signal that covers all of them.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  return (
    <>
      <header className="bg-background flex shrink-0 items-center gap-1 border-b px-2 py-1 md:hidden">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" title="Menu" onClick={() => setDrawerOpen(true)}>
          <Menu className="size-5" />
        </Button>
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

      {/* The current frame's sidebar, off-canvas — the whole desktop frame,
          switcher and sync included, or the phone would be stuck in the frame it is in. */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="overflow-hidden p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {FrameSidebar ? (
            <div className="bg-sidebar text-sidebar-foreground flex min-h-0 flex-1 flex-col">
              <FrameSwitcher />
              <div className="flex min-h-0 flex-1 flex-col">
                <FrameSidebar />
              </div>
              <div className="border-t p-2">
                <SyncBadge />
              </div>
            </div>
          ) : (
            /* flex-1 + min-h-0, or the sidebar grows to its content height inside the
               sheet and its own nav never becomes the scroller. */
            <Sidebar className="min-h-0 w-full flex-1 border-r-0" />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
