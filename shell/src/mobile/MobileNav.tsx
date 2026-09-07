import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Sheet, SheetContent, SheetTitle, cn } from "@lifeline/ui";
import {
  MODULES,
  appsOfModule,
  useAllCommands,
  useIsMobile,
  useKeyboardInset,
  setPhoneNavHeight,
  frameOfPath,
  frames,
  useWorkspaceModules,
  DASHBOARD_FRAME,
  type CommandDef,
} from "@lifeline/core";
import { LayoutDashboard, Menu, Plus } from "lucide-react";
import { MODULE_ICONS } from "./moduleIcons";
import { Sidebar } from "../components/Sidebar";
import { SyncBadge } from "../components/SyncBadge";
import { FrameSwitcher } from "../components/FrameSwitcher";
import { usePhoneHome } from "./phoneHome";


type DialogCommand = CommandDef & { appId: string };

/** One bottom-bar slot; shared by both bars and by the Vault's tab buttons. */
function slot(active: boolean) {
  return cn("flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px]", active ? "text-foreground" : "text-muted-foreground");
}

/**
 * The phone's bottom bar (ADR 0049): **☰ · Home · the Workspace's Modules · +**.
 *
 * The middle belongs to the Modules, capped at three in the Workspace's own
 * order with the rest behind ☰ — so the phone's primary navigation is
 * reconfigured by which Modules the Workspace holds, and a Workspace holding
 * everything is a worse phone than a focused one. That supersedes the slot
 * lists of ADR 0021's per-Frame bars: one bar now, in both Frames, since what
 * differs between them is chrome the Modules already carry.
 *
 * The two switchers — Workspace and Frame — moved to the header (PhoneHeader),
 * which is where the Vault crossing lives now that its slot is spent.
 *
 * Rendered below `md` only.
 */
export function MobileNav() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<DialogCommand | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const home = usePhoneHome();
  const nav = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  // iOS never shrinks the layout viewport for the keyboard, so the frame — and
  // this nav at the foot of it — runs on underneath the keys. The nav reserves
  // that strip itself and ends above them, which Chromium's viewport resize
  // gives for free (ADR 0021 amendment); there this reads 0, as it should.
  const inset = useKeyboardInset(isMobile);

  const modules = useWorkspaceModules();
  const ActiveDialogComponent = activeDialog?.dialog;

  /**
   * The capture sheet lists this Workspace's Modules' Commands and no others
   * (ADR 0047). A list of Commands is chrome, so gating it needs no new
   * principle — and ungated it both buries the ones you want among twenty-three
   * and, in a separated Workspace, offers to strand a Clipping where there is
   * no Clippings screen to find it again. The palette stays open: it is the
   * escape hatch, and always was.
   */
  const captureApps = new Set(modules.flatMap((m) => appsOfModule(m).map((a) => a.id)));
  const captures = useAllCommands().filter((c) => c.capture && (modules.length === 0 || captureApps.has(c.appId)));

  const homeHref = home ? `/screen/${home.id}` : "/phone";
  const homeActive = location.pathname === homeHref || location.pathname === "/phone";

  const frameId = frameOfPath(location.pathname);
  const ws = frames().find((w) => w.id === frameId);
  const FrameSidebar = frameId !== DASHBOARD_FRAME ? ws?.sidebar : undefined;

  // Three, in the Workspace's own order; the rest are behind ☰. Four usable
  // slots is the whole constraint, and a Workspace that wants more of them is a
  // Workspace that has not been decided (ADR 0049).
  const barModules = modules.slice(0, 3).map((id) => MODULES.find((m) => m.id === id)!).filter(Boolean);

  // Whatever the nav actually measures — its safe-area padding included, and 0
  // once `md:hidden` takes it out — is what the editor's accessory bar stacks on
  // top of. Observed rather than assumed: the padding comes and goes with the
  // keyboard, and a guessed number would put the bar over the nav again.
  useEffect(() => {
    const el = nav.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setPhoneNavHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    setPhoneNavHeight(el.getBoundingClientRect().height);
    return () => {
      ro.disconnect();
      setPhoneNavHeight(0);
    };
  }, []);

  // Any tap that navigates closes the drawer. A frame sidebar is not made of
  // links — the Vault's tree, search hits and tags are buttons that navigate — so
  // watching the location is the only signal that covers all of them.
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  function pickCapture(c: DialogCommand) {
    setCaptureOpen(false);
    if (c.dialog) setActiveDialog(c);
    else void c.run?.({ navigate });
  }

  return (
    <>
      <nav
        ref={nav}
        className="bg-background flex shrink-0 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
        // The margin is the keyboard's strip, taken out of the frame so the nav
        // ends above it; with the keyboard up the home indicator is behind it,
        // so its safe-area padding would only be dead height.
        style={inset > 0 ? { marginBottom: inset, paddingBottom: 0 } : undefined}
      >
        <button className={slot(false)} onClick={() => setDrawerOpen(true)}>
          <Menu className="size-5" /> Menu
        </button>
        <button className={slot(homeActive)} onClick={() => navigate(homeHref)}>
          <LayoutDashboard className="size-5" /> Home
        </button>
        {barModules.map((m) => {
          const Icon = MODULE_ICONS[m.id] ?? LayoutDashboard;
          const href = `/module/${m.id}`;
          return (
            <button key={m.id} className={slot(location.pathname === href)} onClick={() => navigate(href)}>
              <Icon className="size-5" /> {m.title}
            </button>
          );
        })}
        <button className={slot(false)} onClick={() => setCaptureOpen(true)}>
          <Plus className="size-5" /> Capture
        </button>
      </nav>

      {/* ☰ drawer: the current frame's sidebar, off-canvas — the whole desktop frame,
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
