/**
 * A Module's Overview (ADR 0066): its landing page, Card instances on the
 * Screen grid. The Module writes the default; the user rearranges it, per
 * Workspace. An Overview nobody has edited follows the default as it changes
 * in code — the Workspace stores an arrangement only once the user has made one.
 */

import type { CardSettings } from "./cards";
import type { ScreenLayoutItem } from "./data/db";
import { cardById } from "./registry";
import { currentWorkspace, saveWorkspace, type WorkspaceRecord } from "./workspaces";

/** One Card in a Module's default Overview, as the Module writes it. */
export interface OverviewSlot {
  cardId: string;
  title?: string;
  settings?: CardSettings;
  /** Spans the whole width rather than half of it. */
  wide?: boolean;
}

const COLS = 12;

/**
 * A Module's default, laid on the grid the way Modules write it: two Cards to
 * a row, a `wide` one alone, each row as tall as its tallest Card's default.
 * Instance ids are stable (`default-<n>`), so the first edit keeps them.
 */
export function defaultOverview(slots: OverviewSlot[]): ScreenLayoutItem[] {
  const out: ScreenLayoutItem[] = [];
  let y = 0;
  let row: { slot: OverviewSlot; i: number }[] = [];
  const flush = () => {
    const h = Math.max(...row.map(({ slot }) => cardById(slot.cardId)?.defaultSize.h ?? 6));
    const w = row.length === 1 && row[0]?.slot.wide ? COLS : COLS / 2;
    row.forEach(({ slot, i }, k) => {
      out.push({
        instanceId: `default-${i}`,
        cardId: slot.cardId,
        ...(slot.settings ? { settings: slot.settings } : {}),
        ...(slot.title ? { title: slot.title } : {}),
        x: k * w,
        y,
        w,
        h,
      });
    });
    y += h;
    row = [];
  };
  slots.forEach((slot, i) => {
    if (slot.wide && row.length > 0) flush();
    row.push({ slot, i });
    if (slot.wide || row.length === 2) flush();
  });
  if (row.length > 0) flush();
  return out;
}

/** What a Workspace shows for one Module's Overview, and whether it is the user's own. */
export function overviewOf(
  ws: WorkspaceRecord | undefined,
  moduleId: string,
  defaults: ScreenLayoutItem[],
): { items: ScreenLayoutItem[]; customised: boolean } {
  const own = ws?.overviews?.[moduleId];
  return own ? { items: own, customised: true } : { items: defaults, customised: false };
}

/** Make this arrangement the current Workspace's own — from the first edit on, it never changes by itself. */
export async function saveOverview(moduleId: string, items: ScreenLayoutItem[]): Promise<void> {
  const ws = await currentWorkspace();
  if (!ws) return;
  await saveWorkspace({ ...ws, overviews: { ...ws.overviews, [moduleId]: items } });
}

/** Reset to default: drop the Workspace's arrangement, so the Overview follows the Module's default again. */
export async function resetOverview(moduleId: string): Promise<void> {
  const ws = await currentWorkspace();
  if (!ws?.overviews?.[moduleId]) return;
  const { [moduleId]: _dropped, ...rest } = ws.overviews;
  await saveWorkspace({ ...ws, overviews: rest });
}
