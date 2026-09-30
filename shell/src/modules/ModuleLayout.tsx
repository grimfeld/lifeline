import type { ReactNode } from "react";
import { NavLink } from "react-router";
import { cn } from "@lifeline/ui";
import {
  appsOfModule,
  basePath,
  frames,
  moduleById,
  moduleScreens,
  screenRoute,
  useDocumentTypes,
  type FrameDef,
} from "@lifeline/core";
import { LayoutDashboard, Table2 } from "lucide-react";
import { useTabHref, useVaultTabMemory, VAULT_TABS, type VaultTab } from "../mobile/vaultTabs";

/**
 * Everything to the right of the Rail when a Module is open (ADR 0057). A
 * Module with a hand-written layout brings its own — today only Note-taking,
 * whose layout is the Vault. Every other Module gets the **stand-in** until
 * its turn comes: its Apps' screens in a plain list, the old sidebar cut down
 * to one Module. Openly temporary.
 *
 * `bare` marks content that manages its own scrolling (a frame's routes).
 */
export function ModuleLayout({ moduleId, bare = false, children }: { moduleId: string; bare?: boolean; children: ReactNode }) {
  const layout = layoutOf(moduleId);
  if (layout) return <FrameModuleLayout moduleId={moduleId} frame={layout} bare={bare}>{children}</FrameModuleLayout>;
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

/** A Module's hand-written layout, if it has one: the frame mounted at its home. */
export function layoutOf(moduleId: string | undefined): FrameDef | undefined {
  const home = moduleById(moduleId)?.home;
  return home ? frames().find((f) => f.path === home) : undefined;
}

/** The Vault as the Note-taking Module's layout: its own sidebar, and on the phone its Folder tabs above. */
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
  const appIds = new Set(appsOfModule(moduleId).map((a) => a.id));
  const types = useDocumentTypes().filter((t) => !t.internal && t.appId && appIds.has(t.appId));
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
                <NavLink key={s.id} to={screenRoute(s)} className={navClass}>
                  <Icon className="size-4" /> {s.title}
                </NavLink>
              );
            })}
        </div>
      ))}
      {types.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="text-muted-foreground px-2 py-1 text-xs font-medium">Raw data</div>
          {types.map((t) => {
            const Icon = t.icon ?? Table2;
            return (
              <NavLink key={t.id} to={basePath(t.id)} className={navClass}>
                <Icon className="size-4" /> {t.label}
              </NavLink>
            );
          })}
        </div>
      )}
    </nav>
  );
}

function navClass({ isActive }: { isActive: boolean }) {
  return cn(
    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
    isActive ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50",
  );
}

/**
 * The Module's own navigation on the phone: at the **top** of the screen, never
 * in the Phone bar, which is Core's (ADR 0057). One scrolling row of its App
 * screens — and for Note-taking, the Vault's Folder tabs first.
 */
function ModuleTabs({ moduleId }: { moduleId: string }) {
  const screens = moduleScreens(moduleId);
  const vault = moduleId === "notes";
  if (!vault && screens.length < 2) return null;
  return (
    <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5 md:hidden">
      {vault && <VaultTabs />}
      {screens.map((s) => {
        const Icon = s.icon ?? LayoutDashboard;
        return (
          <NavLink key={s.id} to={screenRoute(s)} className={tabClass}>
            <Icon className="size-3.5" /> {s.title}
          </NavLink>
        );
      })}
    </div>
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

