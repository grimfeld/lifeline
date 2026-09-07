import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { Sheet, SheetContent, SheetTitle, cn } from "@lifeline/ui";
import {
  useAllCommands,
  useIsMobile,
  useKeyboardInset,
  setPhoneNavHeight,
  frameOfPath,
  frames,
  DASHBOARD_FRAME,
  VAULT_FRAME,
  type CommandDef,
} from "@lifeline/core";
import { CalendarDays, LayoutDashboard, Menu, NotebookText, Plus } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { SyncBadge } from "../components/SyncBadge";
import { FrameSwitcher } from "../components/FrameSwitcher";
import { usePhoneHome } from "./phoneHome";
import { lastLocation } from "../components/FrameSwitcher";
import { useTabHref, useVaultTabMemory, VAULT_TABS, type VaultTab } from "./vaultTabs";

type DialogCommand = CommandDef & { appId: string };

/** One bottom-bar slot; shared by both bars and by the Vault's tab buttons. */
function slot(active: boolean) {
  return cn("flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-[10px]", active ? "text-foreground" : "text-muted-foreground");
}

/**
 * The phone frame's bottom bar. One bar per Frame (ADR 0021, amended
 * 2026-09-05), because the two are used for different things (ADR 0045) and one
 * bar served neither: `Journal` — a Vault screen — sat in a bar that was
 * otherwise Dashboard furniture, while the folders one actually writes in were
 * reachable only by opening ☰ and hunting.
 *
 * - **Dashboard:** ☰ · Home (the designated phone-home Screen) · Journal ·
 *   Vault · "+" capture sheet listing the Apps' capture commands.
 * - **Vault:** ☰ · Notes · Clippings · Writings · Dashboard.
 *
 * The crossing is a slot in each, so the Frame switcher is no longer
 * drawer-only. Rendered below `md` only.
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

  const captures = useAllCommands().filter((c) => c.capture);
  const ActiveDialogComponent = activeDialog?.dialog;

  const homeHref = home ? `/screen/${home.id}` : "/phone";
  const homeActive = location.pathname === homeHref || location.pathname === "/phone";
  const journalActive = location.pathname === "/vault/journal";

  const wsId = frameOfPath(location.pathname);
  const inVault = wsId === VAULT_FRAME;
  // Which Document is open decides the active Vault tab, so the memory has to
  // be read here rather than inside each tab button.
  const activeTab = useVaultTabMemory();
  const ws = frames().find((w) => w.id === wsId);
  const FrameSidebar = wsId !== DASHBOARD_FRAME ? ws?.sidebar : undefined;

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
        {inVault ? (
          <>
            {VAULT_TABS.map((t) => (
              <VaultTabButton key={t.id} tab={t} active={t.id === activeTab?.id} />
            ))}
            {/* The crossing back, landing where the Dashboard was left (ADR 0012's memory). */}
            <button className={slot(false)} onClick={() => navigate(lastLocation(DASHBOARD_FRAME))}>
              <LayoutDashboard className="size-5" /> Dashboard
            </button>
          </>
        ) : (
          <>
            <button className={slot(homeActive)} onClick={() => navigate(homeHref)}>
              <LayoutDashboard className="size-5" /> Home
            </button>
            {/* Journal stays here: "go to today" is a defined operation, which is the
                Dashboard's job; the writing that follows is the Vault's (ADR 0045). */}
            <button className={slot(journalActive)} onClick={() => navigate("/vault/journal")}>
              <CalendarDays className="size-5" /> Journal
            </button>
            <button className={slot(false)} onClick={() => navigate(lastLocation(VAULT_FRAME))}>
              <NotebookText className="size-5" /> Vault
            </button>
            <button className={slot(false)} onClick={() => setCaptureOpen(true)}>
              <Plus className="size-5" /> Capture
            </button>
          </>
        )}
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

/**
 * One Vault tab. Its own component because the href is a live query — the
 * remembered Document, else the folder's newest — and a hook cannot run inside
 * a map in the parent.
 */
function VaultTabButton({ tab, active }: { tab: VaultTab; active: boolean }) {
  const navigate = useNavigate();
  const href = useTabHref(tab);
  const Icon = tab.icon;
  return (
    <button className={slot(active)} onClick={() => navigate(href)}>
      <Icon className="size-5" /> {tab.title}
    </button>
  );
}
