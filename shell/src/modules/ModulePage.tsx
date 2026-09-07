import { Navigate, NavLink, useParams } from "react-router";
import { cn } from "@lifeline/ui";
import {
  MODULES,
  appsOfModule,
  screenRoute,
  screensOf,
  useModuleScreen,
  useWorkspaceModules,
  type AppScreenDef,
} from "@lifeline/core";
import { LayoutDashboard, Table2 } from "lucide-react";
import { UserScreenPage } from "../screens/UserScreenPage";
import { useTabHref, VAULT_TABS, type VaultTab } from "../mobile/vaultTabs";

/** The listed Dashboard screens of a Module's Apps, in registry order. */
export function moduleScreens(moduleId: string): (AppScreenDef & { appId: string })[] {
  const apps = new Set(appsOfModule(moduleId).map((a) => a.id));
  return screensOf().filter((s) => !s.hidden && apps.has(s.appId));
}

/**
 * Where a Module's slot lands (ADR 0049), in precedence order:
 *
 *  1. a Screen of this Workspace that **claims** the Module — the user's own
 *     Cards, and what makes a Module an interface rather than a menu;
 *  2. otherwise a generated **index** of the Module's App screens;
 *  3. otherwise — a Module with exactly one App screen — **straight to it**,
 *     because a menu of one is not navigation.
 *
 * The spread is what makes one rule impossible: Note-taking holds six App
 * screens and Tasks holds one.
 */
export function ModulePage() {
  const { id = "" } = useParams<{ id: string }>();
  const def = MODULES.find((m) => m.id === id);
  const claimed = useModuleScreen(id);
  const modules = useWorkspaceModules();
  const screens = def ? moduleScreens(id) : [];

  if (!def) return <Navigate to="/" replace />;
  // A Module this Workspace does not hold is not an error — the URL is simply
  // not one of its places. Reached by a stale link, or by switching Workspace
  // while standing on it.
  if (modules.length > 0 && !modules.includes(id)) return <Navigate to="/" replace />;

  if (claimed) return <UserScreenPage screenId={claimed.id} />;
  // Rule 3, the pass-through — but never for Note-taking, whose screen also
  // carries the Vault's folder tabs and so is never a menu of one.
  if (screens.length === 1 && id !== "notes") return <Navigate to={screenRoute(screens[0])} replace />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold">{def.title}</h1>
      {/* ADR 0049: the Vault's folder tabs gave the Vault a bar of its own; the
          bar's middle is the Modules now, so they land here — one level down,
          with their reasoning intact (where you go is a Folder, what furniture
          you get there is the type's, ADR 0045). */}
      {id === "notes" && (
        <div className="flex flex-col gap-1">
          {VAULT_TABS.map((t) => (
            <VaultTabRow key={t.id} tab={t} />
          ))}
        </div>
      )}
      {screens.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nothing in this module yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {screens.map((s) => {
            const Icon = s.icon ?? Table2;
            return (
              <NavLink
                key={s.id}
                to={screenRoute(s)}
                className={({ isActive }) =>
                  cn("hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-3 py-3 text-sm", isActive && "bg-accent")
                }
              >
                <Icon className="size-5 shrink-0" />
                <span className="font-medium">{s.title}</span>
              </NavLink>
            );
          })}
        </div>
      )}
      <p className="text-muted-foreground mt-2 text-xs">
        <LayoutDashboard className="mr-1 inline size-3" />
        Make a Screen this module's page from its ⋯ menu, and it opens here instead.
      </p>
    </div>
  );
}


/** One Vault folder tab. Its own component: the href is a live query, so it cannot run inside a map. */
function VaultTabRow({ tab }: { tab: VaultTab }) {
  const href = useTabHref(tab);
  const Icon = tab.icon;
  return (
    <NavLink to={href} className="hover:bg-accent/50 flex items-center gap-3 rounded-lg border px-3 py-3 text-sm">
      <Icon className="size-5 shrink-0" />
      <span className="font-medium">{tab.title}</span>
      <span className="text-muted-foreground ml-auto text-xs">Vault</span>
    </NavLink>
  );
}
