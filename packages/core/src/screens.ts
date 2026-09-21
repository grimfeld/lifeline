/**
 * A Screen's grid, read as the phone reads it (ADR 0021): one column, top to
 * bottom. There is one layout and it is the grid — the phone flattens it and
 * keeps no order of its own, so editing on the phone edits the same coordinates
 * the desktop drags around.
 */

import { useLiveQuery } from "dexie-react-hooks";
import { db, type ScreenLayoutItem, type UserScreen } from "./data/db";
import { put } from "./data/repo";
import { allWorkspaces, currentWorkspace, currentWorkspaceId, useCurrentWorkspaceId } from "./workspaces";

/** The one-column reading of a layout: rows top to bottom, left to right within a row. */
export function stackOrder<T extends ScreenLayoutItem>(items: T[]): T[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x);
}

/**
 * Move one card one place up (`-1`) or down (`1`) in that stacked order, by
 * exchanging grid slots with the neighbour it passes: the phone has no drag,
 * and swapping two cards is what a re-order means on the grid the desktop keeps.
 * Sizes stay with their cards, so a swap of unequal ones can leave the desktop
 * grid overlapping — react-grid-layout compacts that away on render, in the new
 * order. Returns the items untouched at either end of the stack.
 */
export function moveStacked<T extends ScreenLayoutItem>(items: T[], instanceId: string, dir: -1 | 1): T[] {
  const order = stackOrder(items);
  const from = order.findIndex((l) => l.instanceId === instanceId);
  const to = from + dir;
  if (from < 0 || to < 0 || to >= order.length) return items;
  const swapped = [...order];
  swapped[from] = order[to];
  swapped[to] = order[from];
  // Slots stay where they are and the cards move between them — which also
  // settles the case coordinates alone cannot (two cards on the same slot).
  return swapped.map((l, i) => ({ ...l, x: order[i].x, y: order[i].y }));
}


export const SCREENS = "screens";

/**
 * Every Screen of one Workspace, in sort order (ADR 0047: a Screen belongs to
 * the Workspace it was made in, separated or not — it is what gives an
 * unseparated Workspace a face of its own when its Modules decide only the
 * length of its sidebar).
 *
 * Rows written before Workspaces existed carry no `workspace`; they read as
 * belonging to the default Workspace, so a device that has not yet pulled the
 * server-side backfill still shows its Screens rather than an empty sidebar.
 */
export async function screensOfWorkspace(workspaceId?: string): Promise<UserScreen[]> {
  const current = await currentWorkspace();
  const id = workspaceId ?? current?.id ?? currentWorkspaceId();
  const rows = await db().collection<UserScreen>(SCREENS).where("deleted").equals(0).sortBy("sort");
  // An unstamped row belongs to the default Workspace — the first by sort, which
  // is the one the server-side backfill will claim it for. Reading it that way
  // means a device that has not pulled the backfill yet shows its Screens where
  // they are about to land, rather than nowhere.
  const isDefault = await isDefaultWorkspace(id);
  return rows.filter((s) => (s.workspace ? s.workspace === id : isDefault));
}

/** Whether this is the Workspace unstamped rows fall to: the first by sort. */
async function isDefaultWorkspace(id: string): Promise<boolean> {
  const list = await allWorkspaces();
  return list.length === 0 || list[0].id === id;
}

export function useWorkspaceScreens(): UserScreen[] {
  const wsId = useCurrentWorkspaceId();
  // The querier must itself be `async`: Dexie only keeps its liveQuery zone
  // alive across native awaits when it sees an AsyncFunction. A plain arrow
  // returning `screensOfWorkspace()` lost the zone at the first await (the
  // Workspace read), so the `screens` query that followed was never tracked
  // and the sidebar did not react to a Screen being made or deleted.
  return useLiveQuery(async () => screensOfWorkspace(), [wsId], [] as UserScreen[]);
}

/** The Screen claiming a Module in this Workspace — where that Module lands (ADR 0049, rule 1). */
export function useModuleScreen(moduleId: string | undefined): UserScreen | undefined {
  const screens = useWorkspaceScreens();
  return moduleId ? screens.find((s) => s.module === moduleId) : undefined;
}

/** Claim a Module for a Screen, clearing the claim from whichever Screen held it here. */
export async function claimModule(id: string, moduleId: string | undefined): Promise<void> {
  for (const s of await screensOfWorkspace()) {
    if (s.id === id && s.module !== moduleId) await put<UserScreen>(SCREENS, { ...s, module: moduleId });
    else if (s.id !== id && moduleId && s.module === moduleId) await put<UserScreen>(SCREENS, { ...s, module: undefined });
  }
}
