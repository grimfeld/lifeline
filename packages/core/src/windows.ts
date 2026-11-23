/**
 * The **window layout** (ADR 0133): which Windows are open on the Hub's stage,
 * where, in what order, and on which route — per device (localStorage) and per
 * Workspace. Pure: every change is `windowsReducer(layout, action)`; the shell
 * holds the layout in state and saves it.
 *
 * Boxes are **fractions of the stage** (0–1), so the arrangement keeps its
 * proportions when the browser is resized; the limits (a minimum size, the bar
 * kept on the stage) are in CSS pixels, so the actions that move or size a box
 * take the stage's size in pixels.
 */

/** A Window's box, as fractions of the stage: left, top, width, height. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The stage's size in CSS pixels. */
export interface Stage {
  width: number;
  height: number;
}

/**
 * How a Window fills the stage. `normal` is its own box; `snapped` a half or a
 * quarter (#662); `maximised` the whole stage; `full` the whole display, the Hub
 * hidden (#663). Every mode but `normal` keeps the box it had in `restore`.
 */
export type WindowMode = "normal" | "snapped" | "maximised" | "full";

export interface WindowState {
  /** The Window's own id, `<target>:<n>`: several Windows of one target can come later. */
  id: string;
  /** What it shows: a Module id, a Surface id ("calendar", "map", "graph", "screens"), or a page key ("page:settings"). */
  target: string;
  /** Its own place inside its target: a path with its search and hash. */
  route: string;
  box: Box;
  mode: WindowMode;
  /** The box to go back to when it leaves `snapped`, `maximised` or `full`. */
  restore?: Box;
}

export interface WindowLayout {
  /** Back to front: the last is the front Window. */
  windows: WindowState[];
  /** The box each target had when its Window was last closed: a reopened Window takes it. */
  remembered: Record<string, Box>;
  /** The id of the Window opened last: the next one cascades from it. */
  lastOpened?: string;
}

/** Limits, in CSS pixels. */
export const MIN_WIDTH = 320;
export const MIN_HEIGHT = 240;
/** How much of a Window's bar always stays on the stage. */
export const BAR_KEEP = 80;
/** A Window's bar height: the part of it that must stay reachable at the top. */
export const BAR_HEIGHT = 36;
/** A new Window's size, as a fraction of the stage. */
export const OPEN_SIZE = 0.6;
/** How far each new Window is cascaded from the last one opened, as a fraction of the stage. */
export const CASCADE_STEP = 0.04;

export type WindowAction =
  /** Open `target` at `route`; if a Window of that target is open, focus it there instead. */
  | { type: "open"; target: string; route: string; stage: Stage }
  | { type: "focus"; id: string }
  /** Close: its box is remembered for its target, its route is dropped (it reopens on its home). */
  | { type: "close"; id: string }
  | { type: "route"; id: string; route: string }
  /** Move or size to `box` (fractions), clamped to the limits. Leaves a snapped or maximised Window `normal`, at `box`. */
  | { type: "place"; id: string; box: Box; stage: Stage }
  /** Maximise, or restore a maximised Window to its `restore` box. */
  | { type: "maximise"; id: string }
  /** Drop the Windows whose target is not in `targets` (a Module the Workspace no longer takes). */
  | { type: "prune"; targets: string[] };

/** A layout with nothing open. */
export const EMPTY_LAYOUT: WindowLayout = { windows: [], remembered: {} };

export declare function windowsReducer(layout: WindowLayout, action: WindowAction): WindowLayout;

/** The front Window, if any. */
export declare function frontWindow(layout: WindowLayout): WindowState | undefined;

/** A new desk (no saved layout): one maximised Window of `target` at `route`. */
export declare function newDesk(target: string, route: string): WindowLayout;

/** Clamp a box (fractions) to the limits on a stage of this size; returns fractions. */
export declare function clampBox(box: Box, stage: Stage): Box;

/** The box to draw a Window at, in pixels: its mode decides (maximised and full fill the stage). */
export declare function boxInPixels(win: WindowState, stage: Stage): Box;

/** The saved layout of a Workspace on this device, or null when there is none or it can't be read. */
export declare function loadWindowLayout(workspaceId: string): WindowLayout | null;
export declare function saveWindowLayout(workspaceId: string, layout: WindowLayout): void;

/**
 * Where a route opens on the desk: in the Window of a Module or Surface, or as
 * a page (Bases, the Vault, Settings, the Guide, a Module-less App screen),
 * keyed by its first path segment. A user Screen (`/screen/:id`) is the
 * Screens Surface's. Built on `moduleOfPath`.
 */
export type RouteTarget = { kind: "window"; target: string } | { kind: "page"; target: string };
export declare function routeTarget(pathname: string): RouteTarget;
