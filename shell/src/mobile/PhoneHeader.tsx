import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { Button, Sheet, SheetContent, SheetTitle, Tip } from "@lifeline/ui";
import { frameById, frameOfPath, moduleOfPath } from "@lifeline/core";
import { ChevronLeft, CircleHelp, Menu } from "lucide-react";
import { WorkspacePicker } from "../components/WorkspacePicker";
import { Rail } from "../components/Rail";
import { SyncBadge } from "../components/SyncBadge";
import { isSingleScreen, layoutOf, ModuleNav } from "../modules/ModuleLayout";
import { MODULE_SHELLS } from "../modules/shells";
import { guideHref, guideSlugForPath } from "../guide/guidePlace";

/**
 * The phone's header: **☰ · the Workspace picker · ?**, the last opening the
 * Guide on the page for where the user stands (ADR 0089).
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
  // No Module owns the Vault (ADR 0068): its frame's sidebar stands in.
  const FrameSidebar = shell ? undefined : moduleId ? layoutOf(moduleId)?.sidebar : frameById(frameOfPath(location.pathname))?.sidebar;
  const ShellNav = shell?.Nav;
  const hasModuleNav = moduleId ? (!shell || !!ShellNav) && !isSingleScreen(moduleId) : !!FrameSidebar;

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
        <Tip label="Menu">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={openDrawer}>
            <Menu className="size-5" />
          </Button>
        </Tip>
        <div className="min-w-0 flex-1">
          <WorkspacePicker />
        </div>
        <Tip label="Guide">
          <Button variant="ghost" size="icon" className="shrink-0" asChild>
            <Link to={guideHref(guideSlugForPath(location.pathname))}>
              <CircleHelp />
            </Link>
          </Button>
        </Tip>
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
              {/* Gone with the badge where it renders nothing (the Demo, ADR 0077). */}
              <div className="border-t p-2 empty:hidden">
                <SyncBadge />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
