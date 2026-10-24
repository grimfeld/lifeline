import { useMemo } from "react";
import { MODULES, foldById, type CommandDef, type FoldDef } from "./manifest";
import { appById, commandAppTitle, useAllCommands } from "./registry";
import { commandKey, type OwnedCommand } from "./commands";
import { put } from "./data/repo";
import { WORKSPACES } from "./data/db";
import { useCurrentWorkspace, useWorkspaceModules, type WorkspaceRecord } from "./workspaces";

/**
 * The **Capture sheet** (CONTEXT.md): what the Phone bar's centre opens.
 *
 * Found by *where a Command lives*, never by how often it is used: the user's
 * pins on top, always in the same places, then every capture Command grouped
 * under its Module in Core's order. Nothing here reorders itself — capture is
 * muscle memory, and a Command that moves costs the seconds capture is for.
 *
 * Groups never change because of a pin: a pinned Command stays in its group
 * too, so pinning one never shifts the others under the thumb.
 */

export type CaptureCommand = OwnedCommand;

/** How many pins a Workspace holds — a handful, the ones reached for daily. Even, so the two-column grid stays square. */
export const CAPTURE_PINS_MAX = 6;

export type CaptureEntry =
  | { kind: "command"; key: string; title: string; command: CaptureCommand }
  | { kind: "fold"; key: string; title: string; fold: FoldDef; members: CaptureCommand[] };

export interface CaptureGroup {
  id: string;
  title: string;
  entries: CaptureEntry[];
}

export interface CaptureSheet {
  /** The Workspace's pins that still resolve, in the user's order. */
  pinned: CaptureEntry[];
  groups: CaptureGroup[];
  /** Every entry that may be pinned: listed Commands, folds, and the Commands folded under them. */
  pinnable: CaptureEntry[];
}

/** A pin's stored form: an App's Command (`commandKey`), or a fold. */
export function foldKey(f: FoldDef): string {
  return `fold:${f.id}`;
}

/** What a folded Command is called inside its fold's picker. */
export function foldLabelOf(c: CommandDef): string {
  return c.foldLabel ?? c.title;
}

export interface CaptureSheetInput {
  commands: CaptureCommand[];
  /** The Workspace's Modules; empty means none chosen, which offers everything. */
  modules: string[];
  /** The Module an App belongs to, `undefined` for an App in none (the Calendar App). */
  moduleOf: (appId: string) => string | undefined;
  appTitle: (appId: string) => string | undefined;
  pins: string[];
}

/**
 * Lay out the sheet. Pure: everything it reads is passed in.
 *
 * An App in no Module is gated by none (ADR 0057) and gets a group of its own,
 * titled after it, ahead of every Module — the Calendar, since time is what
 * the bar's left already leads with.
 */
export function buildCaptureSheet({ commands, modules, moduleOf, appTitle, pins }: CaptureSheetInput): CaptureSheet {
  const offered = commands.filter((c) => {
    if (!c.capture) return false;
    const m = moduleOf(c.appId);
    return modules.length === 0 || !m || modules.includes(m);
  });

  // Group ids: the Module's, or `app:<id>` for an App in none.
  const groupOf = (c: CaptureCommand) => {
    const m = moduleOf(c.appId);
    return m ? m : `app:${c.appId}`;
  };

  const byGroup = new Map<string, CaptureEntry[]>();
  const folds = new Map<string, Extract<CaptureEntry, { kind: "fold" }>>();
  const pinnable: CaptureEntry[] = [];

  for (const c of offered) {
    const g = groupOf(c);
    const entries = byGroup.get(g) ?? [];
    byGroup.set(g, entries);
    const fold = foldById(c.fold);
    const self: CaptureEntry = { kind: "command", key: commandKey(c), title: c.title, command: c };
    if (!fold) {
      entries.push(self);
      pinnable.push(self);
      continue;
    }
    // A fold sits in the group of its first member; it only exists while it has one.
    let entry = folds.get(fold.id);
    if (!entry) {
      entry = { kind: "fold", key: foldKey(fold), title: fold.title, fold, members: [] };
      folds.set(fold.id, entry);
      entries.push(entry);
      pinnable.push(entry);
    }
    entry.members.push(c);
    pinnable.push(self);
  }

  const groups: CaptureGroup[] = [];
  for (const [id, entries] of byGroup) {
    if (id.startsWith("app:")) groups.push({ id, title: appTitle(id.slice(4)) ?? id.slice(4), entries });
  }
  for (const m of MODULES) {
    const entries = byGroup.get(m.id);
    if (entries) groups.push({ id: m.id, title: m.title, entries });
  }

  // A pin whose Command left the Workspace is dropped, and nothing takes its place.
  const byKey = new Map(pinnable.map((e) => [e.key, e]));
  const pinned = pins.flatMap((k) => byKey.get(k) ?? []).slice(0, CAPTURE_PINS_MAX);

  return { pinned, groups, pinnable };
}

/**
 * Pin or unpin. Returns the new list, or `null` when pinning would go past
 * `CAPTURE_PINS_MAX` — the caller says so rather than dropping an old pin.
 *
 * Stale pins (no longer resolving) are kept in storage, so a Module removed
 * and added back brings its pins back where they were; they never count
 * against the limit, which is about what the user can see.
 */
export function togglePin(pins: string[], key: string, live: Set<string>): string[] | null {
  if (pins.includes(key)) return pins.filter((k) => k !== key);
  if (pins.filter((k) => live.has(k)).length >= CAPTURE_PINS_MAX) return null;
  return [...pins, key];
}

/** Move a pin one place; the others keep theirs. */
export function movePin(pins: string[], key: string, by: -1 | 1): string[] {
  const i = pins.indexOf(key);
  const j = i + by;
  if (i < 0 || j < 0 || j >= pins.length) return pins;
  const next = [...pins];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** The current Workspace's capture sheet. A new Workspace starts with no pins — nothing is guessed. */
export function useCaptureSheet(): CaptureSheet & { pins: string[] } {
  const ws = useCurrentWorkspace();
  const modules = useWorkspaceModules();
  const commands = useAllCommands();
  const pins = ws?.capturePins ?? NO_PINS;
  const sheet = useMemo(
    () =>
      buildCaptureSheet({
        commands,
        modules,
        moduleOf: (id) => appById(id)?.module,
        appTitle: commandAppTitle,
        pins,
      }),
    [commands, modules, pins],
  );
  return { ...sheet, pins };
}

const NO_PINS: string[] = [];

export async function saveCapturePins(ws: WorkspaceRecord, pins: string[]): Promise<void> {
  await put<WorkspaceRecord>(WORKSPACES, { ...ws, capturePins: pins });
}
