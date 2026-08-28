import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Sheet, SheetContent, SheetTitle, cn } from "@lifeline/ui";
import { useAllCommands, workspaceOfPath, workspaces, DASHBOARD_WORKSPACE, type CommandDef } from "@lifeline/core";
import { CalendarDays, LayoutDashboard, Menu, Plus } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { SyncBadge } from "../components/SyncBadge";
import { WorkspaceSwitcher } from "../components/WorkspaceSwitcher";
import { usePhoneHome } from "./phoneHome";

type DialogCommand = CommandDef & { appId: string };

/**
 * The phone frame's bottom bar (grill 2026-08-20): ☰ drawer · Home (the
 * designated phone-home Screen) · Journal · "+" capture sheet listing the
 * Apps' capture commands. Rendered below `md` only.
 */
export function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogCommand | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const home = usePhoneHome();

  const captures = useAllCommands().filter((c) => c.capture);
  const ActiveDialogComponent = activeDialog?.dialog;

  const homeHref = home ? `/screen/${home.id}` : "/phone";
  const homeActive = location.pathname === homeHref || location.pathname === "/phone";
  const journalActive = location.pathname === "/vault/journal";

  const wsId = workspaceOfPath(location.pathname);
  const ws = workspaces().find((w) => w.id === wsId);
  const WorkspaceSidebar = wsId !== DASHBOARD_WORKSPACE ? ws?.sidebar : undefined;

  // Any tap that navigates closes the drawer. A workspace sidebar is not made of
  // links — the Vault's tree, search hits and tags are buttons that navigate — so
  // watching the location is the only signal that covers all of them.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  function slot(active: boolean) {
    return cn(
      "flex flex-col items-center justify-center gap-0.5 py-1 text-[10px]",
      active ? "text-foreground" : "text-muted-foreground",
    );
  }

  function pickCapture(c: DialogCommand) {
    setCaptureOpen(false);
    if (c.dialog) setActiveDialog(c);
    else void c.run?.({ navigate });
  }

  return (
    <>
      <nav className="bg-background flex shrink-0 border-t pb-[env(safe-area-inset-bottom)] md:hidden">
        <button className={cn(slot(false), "flex-1")} onClick={() => setDrawerOpen(true)}>
          <Menu className="size-5" /> Menu
        </button>
        <button className={cn(slot(homeActive), "flex-1")} onClick={() => navigate(homeHref)}>
          <LayoutDashboard className="size-5" /> Home
        </button>
        <button className={cn(slot(journalActive), "flex-1")} onClick={() => navigate("/vault/journal")}>
          <CalendarDays className="size-5" /> Journal
        </button>
        <button className={cn(slot(false), "flex-1")} onClick={() => setCaptureOpen(true)}>
          <Plus className="size-5" /> Capture
        </button>
      </nav>

      {/* ☰ drawer: the current workspace's sidebar, off-canvas — the whole desktop frame,
          switcher and sync included, or the phone would be stuck in the workspace it is in. */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="overflow-hidden p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {WorkspaceSidebar ? (
            <div className="bg-sidebar text-sidebar-foreground flex min-h-0 flex-1 flex-col">
              <WorkspaceSwitcher />
              <div className="flex min-h-0 flex-1 flex-col">
                <WorkspaceSidebar />
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

      {/* "+" capture sheet: the Apps' capture commands, straight to their dialogs. */}
      <Sheet open={captureOpen} onOpenChange={setCaptureOpen}>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetTitle>Capture</SheetTitle>
          <div className="grid grid-cols-2 gap-2 p-4">
            {captures.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={`${c.appId}/${c.id}`}
                  className="border-input hover:bg-accent flex items-center gap-3 rounded-lg border p-3 text-left text-sm"
                  onClick={() => pickCapture(c)}
                >
                  {Icon && <Icon className="size-5 shrink-0" />} {c.title}
                </button>
              );
            })}
            {captures.length === 0 && <p className="text-muted-foreground col-span-2 text-sm">No capture commands registered.</p>}
          </div>
        </SheetContent>
      </Sheet>

      {ActiveDialogComponent && <ActiveDialogComponent open onOpenChange={(o) => !o && setActiveDialog(null)} />}
    </>
  );
}
