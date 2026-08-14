import type { AppManifest, CardDef, CommandDef } from "./manifest";
import type { SchedulableProvider } from "./contracts/schedulable";
import { openDb, type LifelineDB } from "./data/db";

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

export function schedulableProviders(): SchedulableProvider[] {
  return apps.flatMap((a) => (a.schedulable ? [a.schedulable] : []));
}
