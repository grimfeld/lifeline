import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { cn, PhoneDock } from "@lifeline/ui";
import {
  appsOfModule,
  frames,
  moduleById,
  ModuleSurfaceScope,
  moduleScreens,
  screenRoute,
  type FrameDef,
} from "@lifeline/core";
import { LayoutDashboard } from "lucide-react";
import { useTabHref, useVaultTabMemory, VAULT_TABS, type VaultTab } from "../mobile/vaultTabs";
import { MODULE_SHELLS } from "./shells";
import { navRowClass, RawDataLinks } from "./RawDataLinks";

/**
 * Everything to the right of the Rail when a Module is open (ADR 0057). A
 * hand-written Module brings its own layout (`MODULE_SHELLS`), and Note-taking
 * brings the Vault. Every other Module gets the **stand-in** until its turn
 * comes: its Apps' screens in a plain list, the old sidebar cut down to one
 * Module. Openly temporary.
 *
 * Whatever is inside is in the Module's Surface scope, so a Surface a Module
 * embeds shows that Module's items only.
 *
 * `bare` marks content that manages its own scrolling (a frame's routes).
 */
export function ModuleLayout({ moduleId, bare = false, children }: { moduleId: string; bare?: boolean; children: ReactNode }) {
  return (
    <ModuleSurfaceScope moduleId={moduleId}>
      <ModuleChrome moduleId={moduleId} bare={bare}>
        {children}
      </ModuleChrome>
    </ModuleSurfaceScope>
  );
}

function ModuleChrome({ moduleId, bare, children }: { moduleId: string; bare: boolean; children: ReactNode }) {
  const shell = MODULE_SHELLS[moduleId];
  if (shell) return <shell.Layout bare={bare}>{children}</shell.Layout>;
  const layout = layoutOf(moduleId);
  if (layout) return <FrameModuleLayout moduleId={moduleId} frame={layout} bare={bare}>{children}</FrameModuleLayout>;
  // A Module of one screen (Tasks, Mail) wears no chrome of its own: a sidebar
  // holding one link is chrome for nothing, so the App's screen takes the
  // whole width, and its Bases stay one tap away on the Rail.
  if (isSingleScreen(moduleId)) return <main className={cn("min-w-0 flex-1", bare ? "overflow-hidden" : "overflow-y-auto")}>{children}</main>;
  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground flex w-56 shrink-0 flex-col border-r max-md:hidden">
        <ModuleNav moduleId={moduleId} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <ModuleTabs moduleId={moduleId} />
        <main className={cn("min-w-0 flex-1", bare ? "overflow-hidden" : "overflow-y-auto")}>{children}</main>
      </div>
    </>
  );
}

/** Whether a Module on the stand-in shows a single screen, and so wears no chrome of its own. */
export function isSingleScreen(moduleId: string): boolean {
  return !MODULE_SHELLS[moduleId] && !layoutOf(moduleId) && moduleScreens(moduleId).length <= 1;
}

/** A Module's hand-written layout, if it has one: the frame mounted at its home. */
export function layoutOf(moduleId: string | undefined): FrameDef | undefined {
  const home = moduleById(moduleId)?.home;
  return home ? frames().find((f) => f.path === home) : undefined;
}

/**
 * A frame's own layout: its sidebar, and on the phone its Module's tabs — or,
 * for the Vault, which is no Module's layout any more (ADR 0068), its Folder
 * tabs.
 */
export function FrameLayout({ frame, bare = false, children }: { frame: FrameDef; bare?: boolean; children: ReactNode }) {
  const Sidebar = frame.sidebar;
  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground flex w-72 shrink-0 flex-col border-r max-md:hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <Sidebar />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <PhoneDock slot="module">
          <div className="flex gap-1 overflow-x-auto px-2 py-1.5 md:hidden">
            <VaultTabs />
          </div>
        </PhoneDock>
        <main className={cn("min-w-0 flex-1", bare ? "overflow-hidden" : "overflow-y-auto")}>{children}</main>
      </div>
    </>
  );
}

/** A frame mounted at a Module's home as that Module's layout: its own sidebar, and the Module's tabs on the phone. */
function FrameModuleLayout({ moduleId, frame, bare, children }: { moduleId: string; frame: FrameDef; bare: boolean; children: ReactNode }) {
  const Sidebar = frame.sidebar;
  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground flex w-72 shrink-0 flex-col border-r max-md:hidden">
        <div className="flex min-h-0 flex-1 flex-col">
          <Sidebar />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <ModuleTabs moduleId={moduleId} />
        <main className={cn("min-w-0 flex-1", bare ? "overflow-hidden" : "overflow-y-auto")}>{children}</main>
      </div>
    </>
  );
}

/**
 * The stand-in's navigation: the Module's App screens, under their App's name
 * when the Module holds more than one App, and the raw data — the Bases of the
 * types its Apps own — at the foot. A Module links down to its Bases but never
 * re-hosts them (ADR 0057).
 */
export function ModuleNav({ moduleId }: { moduleId: string }) {
  const m = moduleById(moduleId);
  const screens = moduleScreens(moduleId);
  const apps = appsOfModule(moduleId).filter((a) => screens.some((s) => s.appId === a.id));
  const grouped = apps.length > 1;

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
      <div className="px-2 pt-1 text-base font-semibold tracking-tight">{m?.title ?? moduleId}</div>
      {apps.map((a) => (
        <div key={a.id} className="flex flex-col gap-0.5">
          {grouped && <div className="text-muted-foreground px-2 py-1 text-xs font-medium">{a.title}</div>}
          {screens
            .filter((s) => s.appId === a.id)
            .map((s) => {
              const Icon = s.icon ?? LayoutDashboard;
              return (
                <NavLink key={s.id} to={screenRoute(s)} className={navRowClass}>
                  <Icon className="size-4" /> {s.title}
                </NavLink>
              );
            })}
        </div>
      ))}
      <RawDataLinks moduleId={moduleId} />
    </nav>
  );
}

/**
 * The Module's own navigation on the phone: in the **phone dock**, right above
 * the Phone bar but never in it — the bar is Core's (ADR 0057). One scrolling
 * row of its App screens — and for Note-taking, the Vault's Folder tabs first.
 */
function ModuleTabs({ moduleId }: { moduleId: string }) {
  const screens = moduleScreens(moduleId);
  if (screens.length < 2) return null;
  return (
    <PhoneDock slot="module">
      <div className="flex gap-1 overflow-x-auto px-2 py-1.5 md:hidden">
        {screens.map((s) => {
          const Icon = s.icon ?? LayoutDashboard;
          return (
            <NavLink key={s.id} to={screenRoute(s)} className={tabClass}>
              <Icon className="size-3.5" /> {s.title}
            </NavLink>
          );
        })}
      </div>
    </PhoneDock>
  );
}

function tabClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap",
    isActive ? "bg-accent text-accent-foreground border-transparent font-medium" : "text-muted-foreground",
  );
}

function VaultTabs() {
  const current = useVaultTabMemory();
  return (
    <>
      {VAULT_TABS.map((t) => (
        <VaultTabLink key={t.id} tab={t} active={current?.id === t.id} />
      ))}
    </>
  );
}

/** One Vault Folder tab. Its own component: the href is a live query, so it cannot run inside a map. */
function VaultTabLink({ tab, active }: { tab: VaultTab; active: boolean }) {
  const href = useTabHref(tab);
  const Icon = tab.icon;
  return (
    <NavLink to={href} className={() => tabClass({ isActive: active })}>
      <Icon className="size-3.5" /> {tab.title}
    </NavLink>
  );
}

