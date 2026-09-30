import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { Button, Sheet, SheetContent, SheetTitle } from "@lifeline/ui";
import { moduleOfPath } from "@lifeline/core";
import { Menu } from "lucide-react";
import { WorkspacePicker } from "../components/WorkspacePicker";
import { Rail } from "../components/Rail";
import { SyncBadge } from "../components/SyncBadge";
import { layoutOf, ModuleNav } from "../modules/ModuleLayout";

/**
 * The phone's header: **☰ · the Workspace picker**.
 *
 * `☰` opens the drawer: the open Module's own navigation — on the desk, the
 * Module's sidebar — and below it the Rail with its labels (ADR 0057), every
 * place the desk's Rail offers. The Phone bar stays Core's short list
 * of the same Rail; a Module's tabs sit at the top of its own content.
 */
export function PhoneHeader() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const moduleId = moduleOfPath(location.pathname);
  const FrameSidebar = layoutOf(moduleId)?.sidebar;

  // Any tap that navigates closes the drawer. A Module's sidebar is not made of
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
      </header>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" aria-describedby={undefined} className="bg-sidebar text-sidebar-foreground gap-0 overflow-y-auto p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {/* The open Module's own navigation first — it is what the drawer is
              most often opened for — then the Rail. A frame sidebar (the
              Vault's tree) scrolls itself, so it gets a height of its own. */}
          {moduleId && (
            <div className={FrameSidebar ? "flex h-[70dvh] shrink-0 flex-col border-b" : "flex shrink-0 flex-col border-b"}>
              {FrameSidebar ? <FrameSidebar /> : <ModuleNav moduleId={moduleId} />}
            </div>
          )}
          <Rail expanded />
          <div className="border-t p-2">
            <SyncBadge />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
