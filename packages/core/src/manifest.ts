import type * as React from "react";
import type { SchedulableProvider } from "./contracts/schedulable";
import type { TimedProvider } from "./contracts/timed";
import type { DaylogProvider } from "./contracts/daylog";
import type { LoggableProvider } from "./contracts/loggable";
import type { IntakeDef } from "./contracts/intake";
import type { CardSettings, CardSettingsSchema } from "./cards";
import type { Document, DocumentTypeDef } from "./documents/types";
import type { LinkIndex } from "./documents/links";

/**
 * A panel an App adds to the side of every open Document in the Vault
 * (ADR 0032: the Bible App's unlinked references). Rendered under the
 * Local graph and links; returns null when it has nothing to say.
 */
export interface DocumentPanelDef {
  id: string;
  component: React.ComponentType<{ doc: Document; index: LinkIndex }>;
}

/**
 * A local-only Dexie table an App keeps beside the Document store (ADR 0017:
 * a Source's fetch cache). Names start with "_"; never synced.
 */
export interface CollectionDef {
  name: string;
  /** Extra Dexie indexes beyond the standard "id, updatedAt, deleted". */
  indexes?: string[];
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
export const VAULT_WORKSPACE = "vault";

/**
 * A Nav group: one shelf of App screens in a workspace's sidebar. Core owns
 * the list and the order (the sidebar is Core's chrome, ADR 0012); an App
 * only names the group its screen belongs on. A screen naming no group — or
 * an unknown one — stays a plain top-level row.
 */
export interface NavGroupDef {
  id: string;
  title: string;
}

/** The Dashboard's Nav groups, in sidebar order. */
export const NAV_GROUPS: NavGroupDef[] = [
  { id: "home", title: "Home" },
  { id: "planning", title: "Planning" },
  { id: "culture", title: "Culture" },
  { id: "money", title: "Money" },
  { id: "study", title: "Study" },
  { id: "progress", title: "Progress" },
];

export interface AppScreenDef {
  id: string;
  title: string;
  /** Route path: under /app/ for dashboard screens, under the workspace's path otherwise (e.g. "chores", "n/:id"). */
  path: string;
  /** Workspace the screen lives in; default "dashboard". */
  workspace?: string;
  icon?: React.ComponentType<{ className?: string }>;
  component: React.ComponentType;
  /** Nav group this screen is listed under (see NAV_GROUPS); absent = a top-level row. */
  group?: string;
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
   * The Card lists many items and obeys Tag filters (ADR 0014): it gains an
   * optional `tags` setting and is wrapped in the Screen's filter. Single-
   * entity Cards leave this unset and ignore filters. Use cardSchema(def)
   * for the effective schema.
   */
  tagFilterable?: boolean;
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
  /** A capture command records something in seconds (clip, log entry, quick capture…). Listed in the phone's "+" capture sheet. */
  capture?: boolean;
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
  /** Built-in Document types this App owns (ADR 0019). Their `appId` is filled in by the registry. */
  types: DocumentTypeDef[];
  /** Local-only tables ("_"-prefixed), never synced. */
  localTables?: CollectionDef[];
  screens: AppScreenDef[];
  cards: CardDef[];
  commands: CommandDef[];
  /**
   * Commands derived from live data (e.g. one "New <type>…" per user-defined
   * note type). A React hook — the palette calls it for every App in stable
   * registry order (ADR 0003), so it may use live queries.
   */
  useCommands?: () => CommandDef[];
  /**
   * ADR 0020: a Base board layout asks the App to change a guarded field
   * ("user wants engagement → IN_PROGRESS"). The App runs its real operation
   * and returns true, or declines with false. Absent = boards on this App's
   * guarded fields are read-only.
   */
  requestFieldChange?: (doc: Document, field: string, value: string) => Promise<boolean>;
  /** Contract implementations. */
  schedulable?: SchedulableProvider;
  timed?: TimedProvider;
  daylog?: DaylogProvider;
  /** Loggable (ADR 0031): this App's entities other Apps may log occurrences into. */
  loggable?: LoggableProvider;
  /** Intake (ADR 0046): the ways this App accepts a Handoff from another App — each a dialog opened prefilled. */
  intakes?: IntakeDef[];
  /**
   * A React hook the shell runs once, always, for this App — live work that
   * belongs to no screen (ADR 0032: creating Verses from unresolved names).
   * Must be cheap; runs whether or not any of the App's pages is open.
   */
  useBackground?: () => void;
  /** Panels on every open Document's side (see DocumentPanelDef). */
  documentPanels?: DocumentPanelDef[];
  /** A workspace this App provides (ADR 0012). */
  workspace?: WorkspaceDef;
}
