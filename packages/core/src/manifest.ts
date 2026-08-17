import type * as React from "react";
import type { SchedulableProvider } from "./contracts/schedulable";
import type { TimedProvider } from "./contracts/timed";
import type { BacklinkProvider, LinkableProvider } from "./contracts/linkable";
import type { DaylogProvider } from "./contracts/daylog";
import type { LocatableProvider } from "./contracts/locatable";
import type { SyncedRecord } from "./data/db";
import type { CardSettings, CardSettingsSchema } from "./cards";

/** A synced Dexie/PocketBase collection an App owns. */
export interface CollectionDef {
  name: string;
  /** Extra Dexie indexes beyond the standard "id, updatedAt, deleted". */
  indexes?: string[];
  /**
   * Called when a push finds the server copy newer than an unsynced local
   * edit (LWW would drop the local edit). The App may preserve it — the
   * Notes App saves a conflict copy (ADR 0010). Absent = plain LWW.
   */
  onConflict?: (local: SyncedRecord, server: SyncedRecord) => Promise<void>;
}

/**
 * A Workspace (ADR 0012): a full-screen environment over the same data with
 * its own chrome. Core provides the built-in "dashboard" workspace and the
 * switcher; an App may provide another one (the Notes App provides "notes").
 */
export interface WorkspaceDef {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** URL root, e.g. "/notes". Every screen of this workspace is routed below it. */
  path: string;
  /** The workspace's own sidebar (Core renders the switcher above it). */
  sidebar: React.ComponentType;
  /** Where the bare root path lands, relative to `path` (e.g. "journal"). */
  home: string;
}

export const DASHBOARD_WORKSPACE = "dashboard";

export interface AppScreenDef {
  id: string;
  title: string;
  /** Route path: under /app/ for dashboard screens, under the workspace's path otherwise (e.g. "chores", "n/:id"). */
  path: string;
  /** Workspace the screen lives in; default "dashboard". */
  workspace?: string;
  icon?: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  /** Routed but not listed in the sidebar/palette (detail pages such as "stats/:id"). */
  hidden?: boolean;
}

/** Props every Card component receives (ADR 0008). */
export interface CardProps {
  /** Resolved instance settings (defaults filled in). */
  settings: CardSettings;
  /** Opens this instance's configure dialog — for "unavailable, reconfigure" states. */
  configure: () => void;
}

export interface CardDef {
  id: string;
  title: string;
  description?: string;
  component: React.ComponentType<CardProps>;
  /** Grid units (12-column grid, row height ~40px). */
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
  /** Per-instance settings schema; absent = not configurable. */
  settings?: CardSettingsSchema;
  /**
   * Title of one instance given its settings ("Push-ups", "Nightstand · Books").
   * Called as a React hook (inside a per-instance component), so it may use
   * the App's live-query hooks. Return "" to fall back to `title`.
   */
  instanceTitle?: (settings: CardSettings) => string;
}

export interface CommandCtx {
  navigate: (path: string) => void;
}

export interface CommandDef {
  id: string;
  title: string;
  keywords?: string[];
  icon?: React.ComponentType<{ className?: string }>;
  /** Immediate action. Ignored when `dialog` is set. */
  run?: (ctx: CommandCtx) => void | Promise<void>;
  /** Dialog opened when the command is picked. */
  dialog?: React.ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void }>;
}

/**
 * The compile-time manifest an App exports to join the shell (ADR 0003).
 * Everything the Core knows about an App goes through this object.
 */
export interface AppManifest {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Accent color CSS value used for the App's items on shared surfaces. */
  color?: string;
  collections: CollectionDef[];
  screens: AppScreenDef[];
  cards: CardDef[];
  commands: CommandDef[];
  /**
   * Commands derived from live data (e.g. one "New <type>…" per user-defined
   * note type). A React hook — the palette calls it for every App in stable
   * registry order (ADR 0003), so it may use live queries.
   */
  useCommands?: () => CommandDef[];
  /** Contract implementations. */
  schedulable?: SchedulableProvider;
  timed?: TimedProvider;
  linkable?: LinkableProvider;
  backlinks?: BacklinkProvider;
  daylog?: DaylogProvider;
  /** A workspace this App provides (ADR 0012). */
  workspace?: WorkspaceDef;
  locatable?: LocatableProvider;
}
