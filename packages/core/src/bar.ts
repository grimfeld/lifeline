import { useMemo } from "react";
import {
  SURFACES,
  moduleById,
  moduleHome,
  surfaceById,
  type BarSlot,
  type BarSlotKind,
  type SurfaceDef,
} from "./manifest";
import { appById, screenRoute, screensOf } from "./registry";
import { useWorkspaceScreens } from "./screens";
import { put } from "./data/repo";
import { WORKSPACES, type UserScreen } from "./data/db";
import { useCurrentWorkspace, useWorkspaceModules, type WorkspaceRecord } from "./workspaces";

/**
 * The **Phone bar** (ADR 0053, ADR 0063): `Calendar · [slot] · ✛ · [slot] · [slot]`.
 *
 * The far left and the centre are Core's and are not configurable — time is
 * what a phone is taken out of a pocket for, and capture is a verb where the
 * other slots are places, so it is the one control that must be at thumb
 * height on every page. The other three are the user's.
 *
 * This supersedes ADR 0049's derivation of the bar from the Workspace's
 * Modules. A Module list says what a Workspace *shelves*, which is not where
 * its owner *goes*; and the two Surfaces above belong to no Module at all
 * (ADR 0047: "a Module never gates a Surface"), so the one composition rule
 * 0049 allowed was the one rule that could not reach them.
 */

/** The fixed Surface at the far left. Calendar and Schedule were two until ADR 0063 made them one. */
export const BAR_PINNED: SurfaceDef[] = ["calendar"].map((id) => surfaceById(id)!);

/**
 * How many slots the user arranges. Stored in this order: the two right of
 * capture first, then the one left of it — the cell ADR 0063 freed. A bar
 * stored before then holds the right two and reads its new cell as empty,
 * never filled for it.
 */
export const BAR_CUSTOM_SLOTS = 3;

/** The stored index of the slot left of capture. */
export const BAR_LEFT_SLOT = 2;

/** The custom slots' stored indices in the order the bar shows them, left to right. */
export const BAR_SLOT_ORDER = [BAR_LEFT_SLOT, 0, 1];

/** How many slots a new Workspace is seeded with: the right two, as before ADR 0063. */
const BAR_SEEDED_SLOTS = 2;

/**
 * A new Workspace's starting bar, from its own Modules: Tasks and Note-taking
 * where it holds them, else its first two in its own order.
 *
 * The derivation ADR 0049 made the permanent rule survives here, once, where
 * it is harmless — a starting point rather than a law. A Workspace that holds
 * neither preferred Module still gets a useful bar rather than two empty
 * cells, and a Workspace that holds nothing at all gets the empty cells it
 * has earned.
 */
export function seedBar(modules: string[]): BarSlot[] {
  const preferred = ["tasks", "journal", "notes"].filter((m) => modules.includes(m));
  const rest = modules.filter((m) => !preferred.includes(m));
  return [...preferred, ...rest].slice(0, BAR_SEEDED_SLOTS).map((id) => ({ kind: "module" as const, id }));
}

/** A slot's referent, found. `undefined` where it no longer resolves. */
export interface ResolvedSlot {
  slot: BarSlot;
  /** What the cell says: the slot's own label, else the referent's title. */
  title: string;
  path: string;
  /** An App screen brings its own icon; Modules and Surfaces get theirs in the shell. */
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * The current Workspace's custom slots, resolved — `null` where a slot is
 * unset *or* where what it pointed at is gone (ADR 0053).
 *
 * The two cases are deliberately one: a slot whose Screen was deleted, or
 * whose Module this Workspace no longer holds, empties in place rather than
 * being refilled. The bar keeps five cells either way, so the pinned three
 * never move under the thumb because of something that happened on the right,
 * and nothing silently overwrites an arrangement the user made.
 *
 * Always returns exactly `BAR_CUSTOM_SLOTS` entries.
 */
export function useBarSlots(): (ResolvedSlot | null)[] {
  const ws = useCurrentWorkspace();
  const modules = useWorkspaceModules();
  const screens = useWorkspaceScreens();
  // A Workspace written before this ADR has no `bar` and seeds on read rather
  // than in a migration — one code path for old rows and new.
  const slots = ws?.bar ?? seedBar(ws?.modules ?? []);

  return useMemo(() => {
    const out: (ResolvedSlot | null)[] = [];
    for (let i = 0; i < BAR_CUSTOM_SLOTS; i++) out.push(resolveSlot(slots[i], modules, screens));
    return out;
  }, [slots, modules, screens]);
}

/** The raw slots as stored, padded to length — what Settings edits. */
export function useBarConfig(): (BarSlot | null)[] {
  const ws = useCurrentWorkspace();
  const slots = ws?.bar ?? seedBar(ws?.modules ?? []);
  return useMemo(() => {
    const out: (BarSlot | null)[] = [];
    for (let i = 0; i < BAR_CUSTOM_SLOTS; i++) out.push(slots[i] ?? null);
    return out;
  }, [slots]);
}

function resolveSlot(slot: BarSlot | null | undefined, modules: string[], screens: UserScreen[]): ResolvedSlot | null {
  if (!slot) return null;
  const found = destinationOf(slot.kind, slot.id, modules, screens);
  if (!found) return null;
  return { slot, title: slot.label?.trim() || found.title, path: found.path, icon: found.icon };
}

const LEGACY_TIME_SURFACES: Record<string, { title: string; view: string }> = {
  week: { title: "Week", view: "week" },
  schedule: { title: "Schedule", view: "day" },
};

function destinationOf(
  kind: BarSlotKind,
  id: string,
  modules: string[],
  screens: UserScreen[],
): { title: string; path: string; icon?: React.ComponentType<{ className?: string }> } | undefined {
  switch (kind) {
    case "module": {
      const m = moduleById(id);
      // A Module this Workspace does not hold is not a destination here —
      // `ModulePage` turns it away, so the slot would land on a redirect.
      if (!m || !modules.includes(id)) return undefined;
      return { title: m.title, path: moduleHome(m) };
    }
    case "surface": {
      const s = surfaceById(id);
      if (s) return { title: s.title, path: s.path };
      // The Week and Schedule Surfaces are views of the Calendar now (ADR 0063):
      // a slot pointed at one still opens it, as that view.
      const view = LEGACY_TIME_SURFACES[id];
      return view && { title: view.title, path: `/calendar?view=${view.view}` };
    }
    case "screen": {
      const s = screens.find((x) => x.id === id);
      return s && { title: s.name, path: `/screen/${s.id}` };
    }
    case "appScreen": {
      // Ungated by Module on purpose: App screen routes are registered whatever
      // the Workspace holds, and ADR 0047 is explicit that a Module never gates
      // the palette. A slot pointed straight at one keeps working.
      const s = screensOf().find((x) => x.id === id);
      return s && { title: s.title, path: screenRoute(s), icon: s.icon };
    }
  }
}

/** One choice in the slot picker. */
export interface SlotOption {
  slot: BarSlot;
  title: string;
  /** The picker's heading: "Modules", "Surfaces", "Screens", or the App's name. */
  group: string;
  /** As in `ResolvedSlot`: an App screen brings its own, the rest get theirs in the shell. */
  icon?: React.ComponentType<{ className?: string }>;
}

/**
 * Everything a slot may be pointed at, grouped as the sidebar groups it: any
 * destination the sidebar offers (ADR 0053), and nothing the sidebar does not.
 *
 * Modules are this Workspace's own, since a slot on one it does not hold would
 * resolve to nothing the moment it was saved. App screens are *not* filtered
 * that way — see `destinationOf`.
 */
export function useSlotOptions(): SlotOption[] {
  const modules = useWorkspaceModules();
  const screens = useWorkspaceScreens();
  return useMemo(() => {
    const out: SlotOption[] = [];
    for (const id of modules) {
      const m = moduleById(id);
      if (m) out.push({ slot: { kind: "module", id: m.id }, title: m.title, group: "Modules" });
    }
    for (const s of SURFACES) out.push({ slot: { kind: "surface", id: s.id }, title: s.title, group: "Surfaces" });
    for (const s of screens) out.push({ slot: { kind: "screen", id: s.id }, title: s.name, group: "Screens" });
    for (const s of screensOf().filter((x) => !x.hidden))
      out.push({ slot: { kind: "appScreen", id: s.id }, title: s.title, group: appById(s.appId)?.title ?? "Apps", icon: s.icon });
    return out;
  }, [modules, screens]);
}

/** Whether two slots point at the same thing — the picker's tick. */
export function sameSlot(a: BarSlot | null | undefined, b: BarSlot | null | undefined): boolean {
  return !!a && !!b && a.kind === b.kind && a.id === b.id;
}

/**
 * Write the Workspace's bar. Takes the whole array so that clearing a slot and
 * setting one are the same call — the bar is a fixed-length arrangement, not a
 * list things are appended to.
 */
/**
 * The stored form of an arrangement: fixed length, holes kept as `null`.
 *
 * Padded and deliberately **not** compacted. An empty first slot beside a
 * second one that is set has to come back that way — dropping the hole would
 * slide the right-hand slot left the next time the bar was read, which is the
 * rearranging under the thumb ADR 0053 refuses.
 */
export function barToStore(slots: (BarSlot | null)[]): (BarSlot | null)[] {
  const bar: (BarSlot | null)[] = [];
  for (let i = 0; i < BAR_CUSTOM_SLOTS; i++) bar.push(slots[i] ?? null);
  return bar;
}

export async function saveBar(ws: WorkspaceRecord, slots: (BarSlot | null)[]): Promise<void> {
  await put<WorkspaceRecord>(WORKSPACES, { ...ws, bar: barToStore(slots) });
}
