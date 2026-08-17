import { DASHBOARD_WORKSPACE, type AppManifest, type AppScreenDef, type CardDef, type CommandDef, type WorkspaceDef } from "./manifest";
import type { SchedulableProvider } from "./contracts/schedulable";
import type { TimedProvider } from "./contracts/timed";
import type { BacklinkProvider, LinkableProvider } from "./contracts/linkable";
import type { DaylogProvider } from "./contracts/daylog";
import type { LocatableProvider } from "./contracts/locatable";
import { openDb, type LifelineDB, type ScreenLayoutItem } from "./data/db";
import { resolveSettings, type CardSettings } from "./cards";

let apps: AppManifest[] = [];

/**
 * Compile-time registration (ADR 0003): the shell calls this once at startup
 * with every App package's manifest. Opens the local database with all
 * registered collections.
 */
export function initApps(manifests: AppManifest[]): LifelineDB {
  apps = manifests;
  return openDb(manifests.flatMap((a) => a.collections));
}

export function registeredApps(): AppManifest[] {
  return apps;
}

export function appById(id: string): AppManifest | undefined {
  return apps.find((a) => a.id === id);
}

export function allCards(): (CardDef & { appId: string })[] {
  return apps.flatMap((a) => a.cards.map((c) => ({ ...c, appId: a.id })));
}

export function allCommands(): (CommandDef & { appId: string })[] {
  return apps.flatMap((a) => a.commands.map((c) => ({ ...c, appId: a.id })));
}

/** Static + dynamic commands of every App. A React hook (calls each App's `useCommands`). */
export function useAllCommands(): (CommandDef & { appId: string })[] {
  // Hook order is stable: the App list is fixed at compile time (ADR 0003).
  return apps.flatMap((a) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const dynamic = a.useCommands ? a.useCommands() : [];
    return [...a.commands, ...dynamic].map((c) => ({ ...c, appId: a.id }));
  });
}

export function schedulableProviders(): SchedulableProvider[] {
  return apps.flatMap((a) => (a.schedulable ? [a.schedulable] : []));
}

export function timedProviders(): TimedProvider[] {
  return apps.flatMap((a) => (a.timed ? [a.timed] : []));
}

export function linkableProviders(): LinkableProvider[] {
  return apps.flatMap((a) => (a.linkable ? [a.linkable] : []));
}

export function backlinkProviders(): BacklinkProvider[] {
  return apps.flatMap((a) => (a.backlinks ? [a.backlinks] : []));
}

export function daylogProviders(): DaylogProvider[] {
  return apps.flatMap((a) => (a.daylog ? [a.daylog] : []));
}

export function locatableProviders(): LocatableProvider[] {
  return apps.flatMap((a) => (a.locatable ? [a.locatable] : []));
}

/** Collection definition by name (any App). */
export function collectionDef(name: string) {
  return apps.flatMap((a) => a.collections).find((c) => c.name === name);
}

/** Card definition by id, with its owning App id. */
export function cardById(id: string): (CardDef & { appId: string }) | undefined {
  return allCards().find((c) => c.id === id);
}

/**
 * Title of one placed instance. A React hook: `def.instanceTitle` may itself
 * use hooks, so call this from a component rendered once per instance.
 */
export function useCardInstanceTitle(def: CardDef, settings: CardSettings): string {
  // Hook order is stable per component instance: `def` never changes for a mounted card.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const t = def.instanceTitle ? def.instanceTitle(resolveSettings(def.settings, settings)) : "";
  return t || def.title;
}

/**
 * Backfill for layouts saved before instances existed: instanceId = cardId,
 * settings resolved against the current schema. Idempotent.
 */
export function normalizeLayout(items: ScreenLayoutItem[]): ScreenLayoutItem[] {
  return items.map((l) => ({
    ...l,
    instanceId: l.instanceId ?? l.cardId,
    settings: resolveSettings(cardById(l.cardId)?.settings, l.settings),
  }));
}

/** Workspaces provided by Apps (the dashboard is Core's own and not listed here). */
export function workspaces(): (WorkspaceDef & { appId: string })[] {
  return apps.flatMap((a) => (a.workspace ? [{ ...a.workspace, appId: a.id }] : []));
}

export function workspaceById(id: string): (WorkspaceDef & { appId: string }) | undefined {
  return workspaces().find((w) => w.id === id);
}

/** Screens of one workspace, with their owning App id. */
export function screensOf(workspace: string = DASHBOARD_WORKSPACE): (AppScreenDef & { appId: string })[] {
  return apps.flatMap((a) => a.screens.filter((s) => (s.workspace ?? DASHBOARD_WORKSPACE) === workspace).map((s) => ({ ...s, appId: a.id })));
}

/** Absolute route of a screen: /app/<path> in the dashboard, <workspace.path>/<path> elsewhere. */
export function screenRoute(s: AppScreenDef): string {
  const ws = s.workspace ?? DASHBOARD_WORKSPACE;
  if (ws === DASHBOARD_WORKSPACE) return `/app/${s.path}`;
  const w = workspaceById(ws);
  const base = w?.path ?? `/${ws}`;
  return s.path ? `${base}/${s.path}` : base;
}

/** Which workspace a pathname belongs to. */
export function workspaceOfPath(pathname: string): string {
  const w = workspaces().find((w) => pathname === w.path || pathname.startsWith(w.path + "/"));
  return w?.id ?? DASHBOARD_WORKSPACE;
}
