import type * as React from "react";
import type { SchedulableProvider } from "./contracts/schedulable";
import type { TimedProvider } from "./contracts/timed";
import type { DaylogProvider } from "./contracts/daylog";
import type { LoggableProvider } from "./contracts/loggable";
import type { TallyingDef } from "./contracts/tallying";
import type { IntakeDef } from "./contracts/intake";
import type { CardSettings, CardSettingsSchema } from "./cards";
import type { Document, DocumentTypeDef, FieldOption } from "./documents/types";
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
 * A hand-written Module layout with routes of its own (ADR 0057). The word is
 * left over from ADR 0012's Frames, which ADR 0057 retired: today it is only
 * how the Vault — the Note-taking Module's layout — is mounted, under a Module
 * whose `home` is this `path`.
 */
export interface FrameDef {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  /** URL root, e.g. "/notes". Every screen of this frame is routed below it. */
  path: string;
  /** The layout's own sidebar. */
  sidebar: React.ComponentType;
  /** Where the bare root path lands, relative to `path` (e.g. "journal"). */
  home: string;
}

export const DASHBOARD_FRAME = "dashboard";
export const VAULT_FRAME = "vault";

/**
 * A Module (ADR 0057): **the thing the user opens** — a product over one
 * domain, with its own layout and navigation. Core owns the list, the titles
 * and the order; an App names the one Module it belongs to, and the Module
 * arranges what its Apps supply while the Apps keep ownership of their types.
 *
 * A Module scopes chrome — which Modules stand on a Workspace's Rail, its own
 * embedded Surfaces, the capture sheet — never data (that is separation, ADR
 * 0048) and never a general Surface, the Bases or the palette. An App naming
 * no Module has no destination of its own (the Calendar App, whose Events live
 * on the general time Surfaces).
 */
export interface ModuleDef {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * Where the Module lands, when it is not `/module/<id>`: a Module whose
   * layout is a hand-written frame (Note-taking's is the Vault) lives under
   * that frame's path.
   */
  home?: string;
}

/** Core's Modules, in Rail order. A Workspace takes a set of these (ADR 0057). */
export const MODULES: ModuleDef[] = [
  { id: "house", title: "House" },
  // The Projects Module (ADR 0060): Tasks and Projects. Its id predates the name
  // and stays, since Workspaces and Phone bars already store it.
  { id: "tasks", title: "Projects" },
  { id: "culture", title: "Culture" },
  { id: "money", title: "Money" },
  { id: "notes", title: "Note-taking", home: "/vault" },
  { id: "progress", title: "Progress" },
  { id: "languages", title: "Languages" },
  { id: "mail", title: "Mail" },
];

/**
 * A **fold** on the capture sheet: one listed entry standing for several
 * capture Commands that are the same act on sibling types, or on one type's
 * templates (CONTEXT.md "Capture sheet"). It only routes — picking a member
 * opens that App's own dialog, so each App keeps its type and its form.
 *
 * Core's, like the Modules: an App names the fold it sits under and cannot
 * invent one, or the sheet would grow menus inside menus.
 */
export interface FoldDef {
  id: string;
  title: string;
}

export const FOLDS: FoldDef[] = [
  { id: "culture.add", title: "Add to Culture…" },
  { id: "culture.done", title: "Mark done…" },
  { id: "calendar.today", title: "Add today…" },
];

export function foldById(id: string | undefined): FoldDef | undefined {
  return FOLDS.find((f) => f.id === id);
}

/** A Module's landing route. */
export function moduleHome(m: ModuleDef): string {
  return m.home ?? `/module/${m.id}`;
}

export function moduleById(id: string | undefined): ModuleDef | undefined {
  return id ? MODULES.find((m) => m.id === id) : undefined;
}

/**
 * A Core Surface: a fixed, hand-written page over many types through a
 * Contract (CONTEXT.md "Surface"). The list is Core's, as the Modules are;
 * the pages themselves are the shell's, and so are the icons — `SURFACE_ICONS`
 * sits beside `MODULE_ICONS` so Core keeps no view dependency for the sake of
 * a sidebar row or a bar slot.
 *
 * It exists because the Phone bar and its picker need to enumerate Surfaces
 * (ADR 0053), and until then they were five hardcoded `NavLink`s in the
 * sidebar — the only one of the five kinds of page with nothing behind it.
 */
export interface SurfaceDef {
  id: string;
  title: string;
  path: string;
}

/** Core's Surfaces, in sidebar order. */
export const SURFACES: SurfaceDef[] = [
  { id: "calendar", title: "Calendar", path: "/calendar" },
  { id: "map", title: "Map", path: "/map" },
  { id: "graph", title: "Graph", path: "/graph" },
];

export function surfaceById(id: string | undefined): SurfaceDef | undefined {
  return id ? SURFACES.find((s) => s.id === id) : undefined;
}

/**
 * One slot of the **Phone bar** (ADR 0053): a tagged reference to any
 * destination the sidebar offers, never a bare route — a route cannot say
 * which object it came from, and the slot has to know in order to find its
 * title, its icon, and whether the thing still exists.
 *
 * `label` overrides the referent's title for this slot alone. The cell is
 * about 78px at `text-[10px]`, and the sidebar's names are not written for it:
 * the Module titled "Note-taking" is "Notes" on a bar. It lives on the slot
 * rather than on the thing pointed at because a phone-sized label is a fact
 * about the bar, not about the Screen the desk shares.
 */
export type BarSlotKind = "module" | "surface" | "screen" | "appScreen";

export interface BarSlot {
  kind: BarSlotKind;
  id: string;
  label?: string;
}

export interface AppScreenDef {
  id: string;
  title: string;
  /** Route path: under /app/ for dashboard screens, under the frame's path otherwise (e.g. "chores", "n/:id"). */
  path: string;
  /** Frame the screen lives in; default "dashboard". */
  frame?: string;
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

/** Value shapes a Command argument takes. `json` is a structured value whose shape `hint` spells out (a Task's recurrence). */
export type CommandArgKind = "text" | "longtext" | "number" | "boolean" | "date" | "time" | "select" | "multiselect" | "list" | "link" | "json";

/** One argument of a Command's signature (CONTEXT.md "Command"). */
export interface CommandArg {
  key: string;
  label: string;
  kind: CommandArgKind;
  required?: boolean;
  /** select / multiselect. */
  options?: FieldOption[];
  /** link: the Document type (or family) the id must belong to. */
  linkType?: string | string[];
  /** What the value means, for a caller with no dialog to look at — an agent (ADR 0062). */
  hint?: string;
}

/** What a headless Command run reports back: a sentence, and the Document it made or changed. */
export interface CommandResult {
  message: string;
  id?: string;
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
  /**
   * A capture command leaves one new record in seconds, without going
   * anywhere (CONTEXT.md "Command"). Listed in the phone's capture sheet and
   * ranked first in the palette. Starting something live is not capture.
   */
  capture?: boolean;
  /**
   * The Core fold (`FOLDS`) this capture Command sits under on the capture
   * sheet: not listed in its group, reached through the fold's picker, still
   * pinnable and in the palette (CONTEXT.md "Capture sheet").
   */
  fold?: string;
  /** What the fold's picker calls this Command ("Film or series"). Falls back to the title. */
  foldLabel?: string;
  /**
   * The argument signature — what the dialog collects, declared as data so a
   * caller without the dialog can supply it. Paired with `invoke`.
   */
  args?: CommandArg[];
  /**
   * The same operation run headless with `args` already collected (ADR 0062):
   * no UI, no navigation — the App's own operation, so its invariants hold
   * whoever calls. Throws with a readable message on bad input.
   */
  invoke?: (args: Record<string, unknown>) => Promise<CommandResult>;
}

/**
 * The compile-time manifest an App exports to join the shell (ADR 0003).
 * Everything the Core knows about an App goes through this object.
 */
export interface AppManifest {
  id: string;
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  /**
   * The one Module this App belongs to (ADR 0047, ADR 0057): its screens are
   * shown inside that Module's layout. Absent means the App has no destination
   * of its own — its screens still route, bare, and the palette reaches them.
   */
  module?: string;
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
  /** Tallying (ADR 0059): this App's types whose Documents may carry Tallies, and what an occurrence of each reports. */
  tallying?: TallyingDef[];
  /** Intake (ADR 0050): the ways this App accepts a Handoff from another App — each a dialog opened prefilled. */
  intakes?: IntakeDef[];
  /**
   * A React hook the shell runs once, always, for this App — live work that
   * belongs to no screen (ADR 0032: creating Verses from unresolved names).
   * Must be cheap; runs whether or not any of the App's pages is open.
   */
  useBackground?: () => void;
  /** Panels on every open Document's side (see DocumentPanelDef). */
  documentPanels?: DocumentPanelDef[];
  /** A frame this App provides (ADR 0012). */
  frame?: FrameDef;
}
