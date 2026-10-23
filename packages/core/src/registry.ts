import { DASHBOARD_FRAME, MODULES, type AppManifest, type AppScreenDef, type CardDef, type DocumentPanelDef, type ModuleDef, type FrameDef } from "./manifest";
import type { SchedulableProvider } from "./contracts/schedulable";
import type { TimedProvider } from "./contracts/timed";
import type { DaylogProvider } from "./contracts/daylog";
import type { LoggableProvider } from "./contracts/loggable";
import type { RecallableDef } from "./contracts/recallable";
import { MACRO_APP, withMacros, useMacros } from "./macros";
import type { OwnedCommand } from "./commands";
import { openDb, type LifelineDB, type ScreenLayoutItem } from "./data/db";
import { registerBuiltinTypes } from "./documents/registry";
import { registerBuiltinRoles } from "./documents/roles";
import type { DocumentTypeDef } from "./documents/types";
import { resolveSettings, settingsTags, TAGS_FIELD, TAGS_SETTING, type CardSettings, type CardSettingsSchema } from "./cards";

let apps: AppManifest[] = [];

/**
 * Compile-time registration (ADR 0003): the shell calls this once at startup
 * with every App package's manifest. Opens the local database with all
 * registered collections.
 */
export function initApps(manifests: AppManifest[]): LifelineDB {
  apps = manifests;
  const types = manifests.flatMap((a) => a.types.map((t) => ({ ...t, appId: a.id, builtIn: true })));
  registerBuiltinTypes(types);
  registerBuiltinRoles(manifests.flatMap((a) => (a.roles ?? []).map((r) => ({ ...r, appId: a.id }))));
  return openDb(
    types.flatMap((t) => t.indexes ?? []),
    manifests.flatMap((a) => a.localTables ?? []),
  );
}

/** Built-in types of one App. */
export function typesOfApp(appId: string): DocumentTypeDef[] {
  return appById(appId)?.types.map((t) => ({ ...t, appId, builtIn: true })) ?? [];
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

export function allCommands(): OwnedCommand[] {
  return apps.flatMap((a) => a.commands.map((c) => ({ ...c, appId: a.id })));
}

/** What the App behind a Command is called, where a row or group names it; a Macro's is Core's pseudo-App, "Macros". */
export function commandAppTitle(appId: string): string | undefined {
  return appId === MACRO_APP ? "Macros" : appById(appId)?.title;
}

/**
 * Static + dynamic commands of every App, then the user's Macros (ADR 0092),
 * each a Command checked and run against this whole list (`withMacros`). A
 * React hook (calls each App's `useCommands`).
 */
export function useAllCommands(): OwnedCommand[] {
  // Hook order is stable: the App list is fixed at compile time (ADR 0003).
  const own = apps.flatMap((a) => {
    const dynamic = a.useCommands ? a.useCommands() : [];
    return [...a.commands, ...dynamic].map((c) => ({ ...c, appId: a.id }));
  });
  const macros = useMacros();
  return withMacros(own, macros);
}

export function schedulableProviders(): SchedulableProvider[] {
  return apps.flatMap((a) => (a.schedulable ? [a.schedulable] : []));
}

export function timedProviders(): TimedProvider[] {
  return apps.flatMap((a) => (a.timed ? [a.timed] : []));
}

export function daylogProviders(): DaylogProvider[] {
  return apps.flatMap((a) => (a.daylog ? [a.daylog] : []));
}

/** Every Recallable declaration (ADR 0073), in registry order, with the App that owns its type. */
export function recallableDefs(): (RecallableDef & { appId: string })[] {
  return apps.flatMap((a) => (a.recallable ?? []).map((d) => ({ ...d, appId: a.id })));
}

export function loggableProviders(): LoggableProvider[] {
  return apps.flatMap((a) => (a.loggable ? [a.loggable] : []));
}

/** Apps with a background hook, in registry order (stable, so the shell may call the hooks in a loop). */
export function backgroundApps(): AppManifest[] {
  return apps.filter((a) => !!a.useBackground);
}

export function documentPanels(): (DocumentPanelDef & { appId: string })[] {
  return apps.flatMap((a) => (a.documentPanels ?? []).map((p) => ({ ...p, appId: a.id })));
}

/** Effective settings schema of a Card: its own plus the auto-added Tag filter when tagFilterable. */
export function cardSchema(def: Pick<CardDef, "settings" | "tagFilterable"> | undefined): CardSettingsSchema | undefined {
  if (!def) return undefined;
  if (!def.tagFilterable) return def.settings;
  return { ...(def.settings ?? {}), [TAGS_SETTING]: TAGS_FIELD };
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
  const t = def.instanceTitle ? def.instanceTitle(resolveSettings(cardSchema(def), settings)) : "";
  const base = t || def.title;
  // A tagFilterable instance with its own filter says so: "Today · #garden #plants" (ADR 0014).
  const tags = def.tagFilterable ? settingsTags(settings) : [];
  return tags.length > 0 ? `${base} · ${tags.map((x) => `#${x}`).join(" ")}` : base;
}

/**
 * Backfill for layouts saved before instances existed: instanceId = cardId,
 * settings resolved against the current schema. Idempotent.
 */
export function normalizeLayout(items: ScreenLayoutItem[]): ScreenLayoutItem[] {
  return items.map((l) => ({
    ...l,
    instanceId: l.instanceId ?? l.cardId,
    settings: resolveSettings(cardSchema(cardById(l.cardId)), l.settings),
  }));
}

/** Frames provided by Apps (the dashboard is Core's own and not listed here). */
export function frames(): (FrameDef & { appId: string })[] {
  return apps.flatMap((a) => (a.frame ? [{ ...a.frame, appId: a.id }] : []));
}

export function frameById(id: string): (FrameDef & { appId: string }) | undefined {
  return frames().find((w) => w.id === id);
}

/** Screens of one frame, with their owning App id. */
export function screensOf(frame: string = DASHBOARD_FRAME): (AppScreenDef & { appId: string })[] {
  return apps.flatMap((a) => a.screens.filter((s) => (s.frame ?? DASHBOARD_FRAME) === frame).map((s) => ({ ...s, appId: a.id })));
}

/** The Module an App belongs to, or undefined when it names none or an unknown one. */
export function moduleOfApp(appId: string): ModuleDef | undefined {
  const m = appById(appId)?.module;
  return m ? MODULES.find((x) => x.id === m) : undefined;
}

/** Apps belonging to one Module, in registry order. */
export function appsOfModule(moduleId: string): AppManifest[] {
  return apps.filter((a) => a.module === moduleId);
}

/** Modules that actually have an App behind them — Core's list minus the empty shelves. */
export function inhabitedModules(): ModuleDef[] {
  return MODULES.filter((m) => apps.some((a) => a.module === m.id));
}

/** One shelf of the sidebar: a Module and its screens, or the loose screens whose Apps name none. */
export interface NavSection {
  group?: ModuleDef;
  screens: (AppScreenDef & { appId: string })[];
}

/**
 * The listed screens of a frame, folded into Core's Modules (ADR 0047): the
 * loose ones first (a screen whose App names no Module, or an unknown one,
 * stays a top-level row), then each non-empty Module in MODULES order.
 *
 * `modules` restricts the shelves to a Workspace's own — a Module gates chrome
 * and this is the chrome it gates. Loose screens are never restricted: an App
 * that names no Module belongs to no Workspace's exclusion either.
 */
export function navSectionsOf(frame: string = DASHBOARD_FRAME, modules?: string[]): NavSection[] {
  const listed = screensOf(frame).filter((s) => !s.hidden);
  const known = new Set(MODULES.map((g) => g.id));
  const moduleOf = (s: AppScreenDef & { appId: string }) => appById(s.appId)?.module;
  const loose = listed.filter((s) => {
    const m = moduleOf(s);
    return !m || !known.has(m);
  });
  const wanted = modules ? MODULES.filter((m) => modules.includes(m.id)) : MODULES;
  const groups = wanted
    .map((group) => ({ group, screens: listed.filter((s) => moduleOf(s) === group.id) }))
    .filter((s) => s.screens.length > 0);
  return loose.length > 0 ? [{ screens: loose }, ...groups] : groups;
}

/** Absolute route of a screen: /app/<path> in the dashboard, <frame.path>/<path> elsewhere. */
export function screenRoute(s: AppScreenDef): string {
  const ws = s.frame ?? DASHBOARD_FRAME;
  if (ws === DASHBOARD_FRAME) return `/app/${s.path}`;
  const w = frameById(ws);
  const base = w?.path ?? `/${ws}`;
  return s.path ? `${base}/${s.path}` : base;
}

/** Which frame a pathname belongs to. */
export function frameOfPath(pathname: string): string {
  const w = frames().find((w) => pathname === w.path || pathname.startsWith(w.path + "/"));
  return w?.id ?? DASHBOARD_FRAME;
}

/**
 * Which Module a pathname is inside (ADR 0057), or undefined for Core's own
 * destinations — the general Surfaces, the Bases, Screens and Settings — and
 * for the bare screens of an App that names no Module.
 */
export function moduleOfPath(pathname: string): string | undefined {
  const under = (root: string) => pathname === root || pathname.startsWith(root + "/");
  for (const m of MODULES) if (m.home && under(m.home)) return m.id;
  const direct = /^\/module\/([^/]+)/.exec(pathname);
  if (direct) return MODULES.some((m) => m.id === direct[1]) ? direct[1] : undefined;
  // An App screen: the longest registered route that holds the path wins
  // ("/app/ledger/budget" over "/app/ledger"), and it is in its App's Module.
  let best = -1;
  let found: string | undefined;
  for (const s of screensOf()) {
    const route = screenRoute(s).replace(/\/:[^/]+.*$/, "");
    if (under(route) && route.length > best) {
      best = route.length;
      found = appById(s.appId)?.module;
    }
  }
  return found && MODULES.some((m) => m.id === found) ? found : undefined;
}

/** The listed screens of a Module's Apps, in registry order — what its stand-in layout lists. */
export function moduleScreens(moduleId: string): (AppScreenDef & { appId: string })[] {
  const ids = new Set(appsOfModule(moduleId).map((a) => a.id));
  return screensOf().filter((s) => !s.hidden && ids.has(s.appId));
}

