import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Button, Sheet, SheetContent, SheetTitle } from "@lifeline/ui";
import { moduleOfPath } from "@lifeline/core";
import { ChevronLeft, Menu } from "lucide-react";
import { WorkspacePicker } from "../components/WorkspacePicker";
import { Rail } from "../components/Rail";
import { SyncBadge } from "../components/SyncBadge";
import { isSingleScreen, layoutOf, ModuleNav } from "../modules/ModuleLayout";
import { MODULE_SHELLS } from "../modules/shells";

/**
 * The phone's header: **☰ · the Workspace picker**.
 *
 * `☰` opens the drawer. Inside a Module it opens on the Module's own
 * navigation — on the desk, the Module's sidebar — with a back button to the
 * Rail with its labels (ADR 0057), every place the desk's Rail offers; the two
 * are never stacked in one list. Anywhere else it opens on the Rail. The Phone
 * bar stays Core's short list of the same Rail; a Module's tabs sit in the
 * phone dock just above it, with the page's own controls.
 */
export function PhoneHeader() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showRail, setShowRail] = useState(false);
  const moduleId = moduleOfPath(location.pathname);
  const shell = moduleId ? MODULE_SHELLS[moduleId] : undefined;
  const FrameSidebar = shell ? undefined : layoutOf(moduleId)?.sidebar;
  const ShellNav = shell?.Nav;
  const hasModuleNav = !!moduleId && (!shell || !!ShellNav) && !isSingleScreen(moduleId);

  // The drawer always opens on the Module's navigation, wherever it was left.
  const openDrawer = () => {
    setShowRail(false);
    setDrawerOpen(true);
  };

  // Any tap that navigates closes the drawer. A Module's sidebar is not made of
  // links — the Vault's tree, search hits and tags are buttons that navigate —
  // so watching the location is the only signal that covers all of them.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  return (
    <>
      <header className="bg-background flex shrink-0 items-center gap-1 border-b px-2 py-1 md:hidden">
        <Button variant="ghost" size="icon" className="size-8 shrink-0" title="Menu" onClick={openDrawer}>
          <Menu className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <WorkspacePicker />
        </div>
      </header>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="bg-sidebar text-sidebar-foreground gap-0 overflow-y-auto p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {hasModuleNav && !showRail ? (
            // The open Module's own navigation — what the drawer is most often
            // opened for — with the way back to the Rail above it. Each nav
            // scrolls itself, so it takes the rest of the drawer's height.
            <div className="flex min-h-0 flex-1 flex-col">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 border-b px-3 py-2.5 text-sm"
                onClick={() => setShowRail(true)}
              >
                <ChevronLeft className="size-4" /> All places
              </button>
              <div className="flex min-h-0 flex-1 flex-col">
                {ShellNav ? <ShellNav /> : FrameSidebar ? <FrameSidebar /> : <ModuleNav moduleId={moduleId!} />}
              </div>
            </div>
          ) : (
            <>
              <Rail expanded />
              <div className="border-t p-2">
                <SyncBadge />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
