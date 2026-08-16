import type * as React from "react";
import type { SchedulableProvider } from "./contracts/schedulable";
import type { TimedProvider } from "./contracts/timed";

/** A synced Dexie/PocketBase collection an App owns. */
export interface CollectionDef {
  name: string;
  /** Extra Dexie indexes beyond the standard "id, updatedAt, deleted". */
  indexes?: string[];
}

export interface AppScreenDef {
  id: string;
  title: string;
  /** Route path under /app/, e.g. "chores". */
  path: string;
  icon?: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  /** Routed but not listed in the sidebar/palette (detail pages such as "stats/:id"). */
  hidden?: boolean;
}

export interface CardDef {
  id: string;
  title: string;
  description?: string;
  component: React.ComponentType;
  /** Grid units (12-column grid, row height ~40px). */
  defaultSize: { w: number; h: number };
  minSize?: { w: number; h: number };
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
  /** Contract implementations. */
  schedulable?: SchedulableProvider;
  timed?: TimedProvider;
}
