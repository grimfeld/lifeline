import { SURFACES } from "./manifest";
import { moduleOfPath } from "./registry";

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
  /** What it shows: a Module id or a Surface id ("calendar", "map", "graph", "screens"). Never a page (#663). */
  target: string;
  /** Its own place inside its target: a path with its search and hash. */
  route: string;
  box: Box;
  mode: WindowMode;
  /** The box to go back to when it leaves `snapped`, `maximised` or `full`. */
  restore?: Box;
  /** In full screen: the mode it goes back to when it leaves (#663). */
  was?: Exclude<WindowMode, "full">;
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
  /**
   * Snap to `box` (a half or a quarter, fractions), or maximise when `box` is
   * "max". The box it had before the first snap is kept in `restore` while it
   * snaps from one zone to another.
   */
  | { type: "snap"; id: string; box: Box | "max" }
  /** A snapped or maximised Window back to the box it had before, within the limits. */
  | { type: "restore"; id: string; stage: Stage }
  /** The bar's double-click: maximise a normal Window; restore a maximised or snapped one. */
  | { type: "toggle"; id: string; stage: Stage }
  /**
   * Full screen (#663): the Window fills the display and the Hub hides; asked
   * again (or Esc), it goes back to the mode and box it had.
   */
  | { type: "fullScreen"; id: string }
  /** Drop the Windows whose target is not in `targets` (a Module the Workspace no longer takes). */
  | { type: "prune"; targets: string[] };

/** A layout with nothing open. */
export const EMPTY_LAYOUT: WindowLayout = { windows: [], remembered: {} };

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Where the first Window of an empty stage, and a wrapped cascade, start. */

/** Clamp a box (fractions) to the limits on a stage of this size; returns fractions. */
export function clampBox(box: Box, stage: Stage): Box {
  if (stage.width <= 0 || stage.height <= 0) return { ...box };
  const wPx = Math.min(Math.max(box.w * stage.width, MIN_WIDTH), stage.width);
  const hPx = Math.min(Math.max(box.h * stage.height, MIN_HEIGHT), stage.height);
  const xPx = clamp(box.x * stage.width, BAR_KEEP - wPx, stage.width - BAR_KEEP);
  const yPx = clamp(box.y * stage.height, 0, stage.height - BAR_HEIGHT);
  return { x: xPx / stage.width, y: yPx / stage.height, w: wPx / stage.width, h: hPx / stage.height };
}

/** The box to draw a Window at, in pixels: its mode decides (maximised and full fill the stage). */
export function boxInPixels(win: WindowState, stage: Stage): Box {
  if (win.mode === "full" || win.mode === "maximised") return { x: 0, y: 0, w: stage.width, h: stage.height };
  const b = win.box;
  return { x: b.x * stage.width, y: b.y * stage.height, w: b.w * stage.width, h: b.h * stage.height };
}

/** The box a Window keeps when it closes: its own, not the one a mode gave it. */
function normalBox(win: WindowState): Box {
  return win.mode === "normal" ? win.box : (win.restore ?? win.box);
}

function openBox(layout: WindowLayout, target: string, stage: Stage): Box {
  const remembered = layout.remembered[target];
  if (remembered) return clampBox(remembered, stage);
  const last = layout.windows.find((w) => w.id === layout.lastOpened);
  const w = OPEN_SIZE;
  const h = OPEN_SIZE;
  let x = (1 - w) / 2;
  let y = (1 - h) / 2;
  if (last) {
    const from = normalBox(last);
    x = from.x + CASCADE_STEP;
    y = from.y + CASCADE_STEP;
    if (x + w > 1 || y + h > 1) {
      x = CASCADE_STEP;
      y = CASCADE_STEP;
    }
  }
  return clampBox({ x, y, w, h }, stage);
}

function nextId(layout: WindowLayout, target: string): string {
  const taken = new Set(layout.windows.map((w) => w.id));
  for (let n = 1; ; n++) if (!taken.has(`${target}:${n}`)) return `${target}:${n}`;
}

function toFront(layout: WindowLayout, id: string, patch?: Partial<WindowState>): WindowLayout {
  const win = layout.windows.find((w) => w.id === id);
  if (!win) return layout;
  return { ...layout, windows: [...layout.windows.filter((w) => w.id !== id), { ...win, ...patch }] };
}

function update(layout: WindowLayout, id: string, f: (w: WindowState) => WindowState): WindowLayout {
  if (!layout.windows.some((w) => w.id === id)) return layout;
  return { ...layout, windows: layout.windows.map((w) => (w.id === id ? f(w) : w)) };
}

/** Every change to the layout: a pure step from one layout to the next. */
/** The box a Window had before it was snapped or maximised: kept in `restore`, or its own when it never left. */
const boxBeforeSnap = (w: WindowState): Box => w.restore ?? w.box;

/** A Window with only its own box: no box to go back to, no mode to go back to. */
const bare = (w: WindowState) => ({ id: w.id, target: w.target, route: w.route, box: w.box });

/** A snapped or maximised Window back at the box it had before, clamped to the limits on this stage. */
function restored(w: WindowState, stage: Stage): WindowState {
  if (w.mode !== "snapped" && w.mode !== "maximised") return w;
  return { ...w, mode: "normal", box: clampBox(boxBeforeSnap(w), stage), restore: undefined };
}

export function windowsReducer(layout: WindowLayout, action: WindowAction): WindowLayout {
  switch (action.type) {
    case "open": {
      const existing = layout.windows.find((w) => w.target === action.target);
      if (existing) return toFront(layout, existing.id, { route: action.route });
      const id = nextId(layout, action.target);
      const win: WindowState = { id, target: action.target, route: action.route, box: openBox(layout, action.target, action.stage), mode: "normal" };
      return { ...layout, windows: [...layout.windows, win], lastOpened: id };
    }
    case "focus":
      return layout.windows[layout.windows.length - 1]?.id === action.id ? layout : toFront(layout, action.id);
    case "close": {
      const win = layout.windows.find((w) => w.id === action.id);
      if (!win) return layout;
      return {
        ...layout,
        windows: layout.windows.filter((w) => w.id !== action.id),
        remembered: { ...layout.remembered, [win.target]: normalBox(win) },
      };
    }
    case "route":
      return update(layout, action.id, (w) => (w.route === action.route ? w : { ...w, route: action.route }));
    case "place":
      return update(layout, action.id, (w) => ({ ...bare(w), mode: "normal", box: clampBox(action.box, action.stage) }));
    case "maximise":
      return update(layout, action.id, (w) => {
        if (w.mode === "maximised") return { ...w, mode: "normal", box: w.restore ?? w.box, restore: undefined };
        if (w.mode === "normal") return { ...w, mode: "maximised", restore: w.box };
        // From a snap: back to the box it had before the snap, not the snapped one.
        if (w.mode === "snapped") return { ...w, mode: "maximised", restore: boxBeforeSnap(w) };
        return w;
      });
    case "snap":
      return update(layout, action.id, (w) => {
        const restore = w.mode === "normal" ? w.box : boxBeforeSnap(w);
        // From full screen too: the Window leaves it for the snap.
        return action.box === "max" ? { ...bare(w), mode: "maximised", restore } : { ...bare(w), mode: "snapped", box: action.box, restore };
      });
    case "restore":
      return update(layout, action.id, (w) => restored(w, action.stage));
    case "toggle":
      return update(layout, action.id, (w) => (w.mode === "normal" ? { ...w, mode: "maximised", restore: w.box } : restored(w, action.stage)));
    case "fullScreen":
      return update(layout, action.id, (w) => {
        if (w.mode === "full") {
          // The box and the box before a snap were kept as they were: only the mode comes back.
          const mode = w.was ?? "normal";
          return mode === "normal" ? { ...bare(w), mode } : { ...bare(w), mode, restore: w.restore ?? w.box };
        }
        return { ...w, mode: "full", was: w.mode, restore: w.mode === "normal" ? w.box : boxBeforeSnap(w) };
      });
    case "prune": {
      // A page is never a Window (#663): a layout saved before holds none after this.
      const keep = new Set(action.targets);
      const windows = layout.windows.filter((w) => keep.has(w.target));
      return windows.length === layout.windows.length ? layout : { ...layout, windows };
    }
  }
}

/** The front Window, if any. */
export function frontWindow(layout: WindowLayout): WindowState | undefined {
  return layout.windows[layout.windows.length - 1];
}

/** A new desk (no saved layout): one maximised Window of `target` at `route`. */
export function newDesk(target: string, route: string): WindowLayout {
  const box = { x: (1 - OPEN_SIZE) / 2, y: (1 - OPEN_SIZE) / 2, w: OPEN_SIZE, h: OPEN_SIZE };
  const id = `${target}:1`;
  return { windows: [{ id, target, route, box, mode: "maximised", restore: box }], remembered: {}, lastOpened: id };
}

const storageKey = (workspaceId: string) => `lifeline:windows:${workspaceId}`;

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isBox = (v: unknown): v is Box => isObj(v) && isNum(v.x) && isNum(v.y) && isNum(v.w) && isNum(v.h);
const MODES: readonly unknown[] = ["normal", "snapped", "maximised", "full"];

function isWindow(v: unknown): v is WindowState {
  return (
    isObj(v) &&
    typeof v.id === "string" &&
    typeof v.target === "string" &&
    typeof v.route === "string" &&
    // An address inside the app, never another origin's (`//host`, `https://…`).
    /^\/(?!\/)/.test(v.route) &&
    isBox(v.box) &&
    MODES.includes(v.mode) &&
    (v.restore === undefined || isBox(v.restore)) &&
    (v.was === undefined || (v.was !== "full" && MODES.includes(v.was)))
  );
}

function isLayout(v: unknown): v is WindowLayout {
  return (
    isObj(v) &&
    Array.isArray(v.windows) &&
    v.windows.every(isWindow) &&
    isObj(v.remembered) &&
    Object.values(v.remembered).every(isBox) &&
    (v.lastOpened === undefined || typeof v.lastOpened === "string")
  );
}

/** The saved layout of a Workspace on this device, or null when there is none or it can't be read. */
export function loadWindowLayout(workspaceId: string): WindowLayout | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(workspaceId));
    if (raw == null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isLayout(parsed)) return null;
    // A page is never a Window (#663): one a layout saved before still holds is dropped.
    const windows = parsed.windows.filter((w) => !isPageTarget(w.target));
    return windows.length === parsed.windows.length ? parsed : { ...parsed, windows };
  } catch {
    return null;
  }
}

export function saveWindowLayout(workspaceId: string, layout: WindowLayout): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(storageKey(workspaceId), JSON.stringify(layout));
  } catch {
    /* private mode or full: the layout lasts the session */
  }
}

/**
 * Where a route opens on the desk: in the Window of a Module or Surface, or as
 * a full-screen page over the Hub (Bases, the Vault, Settings, the Guide, a
 * Module-less App screen, and any other route: #663), keyed by its first path
 * segment. A user Screen (`/screen/:id`) is the Screens Surface's. Built on
 * `moduleOfPath`.
 */
export type RouteTarget = { kind: "window"; target: string } | { kind: "page"; target: string };

export function routeTarget(pathname: string): RouteTarget {
  const mod = moduleOfPath(pathname);
  if (mod) return { kind: "window", target: mod };
  const under = (root: string) => pathname === root || pathname.startsWith(root + "/");
  const surface = SURFACES.find((s) => under(s.path));
  if (surface) return { kind: "window", target: surface.id };
  if (under("/screens") || under("/screen")) return { kind: "window", target: SCREENS_TARGET };
  return { kind: "page", target: pageTarget(pathname.split("/")[1] ?? "") };
}

/** The Screens Surface's Window: it holds `/screens` and every user Screen (`/screen/:id`). */
export const SCREENS_TARGET = "screens";

/** The general Surfaces a desk opens as Windows, in the Hub's order: SURFACES, then Screens. */
export const DESK_SURFACES: readonly { id: string; title: string; path: string }[] = [
  ...SURFACES,
  { id: SCREENS_TARGET, title: "Screens", path: "/screens" },
];

/** A page's target, by the first segment of its path: "page:settings". */
export function pageTarget(segment: string): string {
  return "page:" + segment;
}

export function isPageTarget(target: string): boolean {
  return target.startsWith("page:");
}

/** A route without its search and hash. */
export function pathOnly(route: string): string {
  return route.split(/[?#]/)[0]!;
}

/**
 * A Window's own history (ADR 0133: Back and Forward act on the front Window).
 * Held in memory beside the layout, not saved: a reload starts each Window's
 * history at its route.
 */
export interface WindowHistory {
  entries: string[];
  index: number;
}

/** A navigation inside a Window: a new entry after the current one (the forward ones go), or the current one replaced. */
export function recordRoute(h: WindowHistory | undefined, route: string, replace: boolean): WindowHistory {
  if (!h) return { entries: [route], index: 0 };
  if (h.entries[h.index] === route) return h;
  if (replace) return { entries: h.entries.map((e, i) => (i === h.index ? route : e)), index: h.index };
  return { entries: [...h.entries.slice(0, h.index + 1), route], index: h.index + 1 };
}

/** Back (-1) or Forward (+1) within a Window's history; undefined when it has nowhere to go that way. */
export function stepRoute(h: WindowHistory | undefined, delta: number): { history: WindowHistory; route: string } | undefined {
  if (!h || delta === 0) return undefined;
  const index = h.index + Math.sign(delta);
  if (index < 0 || index >= h.entries.length) return undefined;
  return { history: { ...h, index }, route: h.entries[index]! };
}

/** The two halves the bar's snap buttons fill, and the whole stage a top-middle drop fills. */
export const LEFT_HALF: Box = { x: 0, y: 0, w: 0.5, h: 1 };
export const RIGHT_HALF: Box = { x: 0.5, y: 0, w: 0.5, h: 1 };
export const WHOLE_STAGE: Box = { x: 0, y: 0, w: 1, h: 1 };

/** How close to a stage edge (CSS px) a drop snaps. */
export const SNAP_EDGE = 28;
/** The outer part of an edge, at each end, that snaps to a quarter rather than a half. */
export const SNAP_CORNER = 0.3;

/**
 * What a drop at `pointer` (CSS px, relative to the stage) snaps to: a half on
 * the left or right edge, a quarter on the outer 30% of the left, right or top
 * edge, the whole stage ("max") on the top edge's middle — or nothing.
 */
export function snapZone(pointer: { x: number; y: number }, stage: Stage): Box | "max" | null {
  const { width, height } = stage;
  if (width <= 0 || height <= 0) return null;
  const { x, y } = pointer;
  const left = x < SNAP_EDGE;
  const right = x > width - SNAP_EDGE;
  const top = y < SNAP_EDGE;
  const quarter = (l: boolean, t: boolean): Box => ({ x: l ? 0 : 0.5, y: t ? 0 : 0.5, w: 0.5, h: 0.5 });
  if (left || right) {
    if (y < height * SNAP_CORNER) return quarter(left, true);
    if (y > height * (1 - SNAP_CORNER)) return quarter(left, false);
    return left ? LEFT_HALF : RIGHT_HALF;
  }
  if (top) {
    if (x < width * SNAP_CORNER) return quarter(true, true);
    if (x > width * (1 - SNAP_CORNER)) return quarter(false, true);
    return "max";
  }
  return null;
}

/**
 * Where a snapped or maximised Window being dragged away goes: the size it had
 * before, placed so the point of the bar the pointer took stays under it.
 * `drawn` is its box on screen and `pointerX` the pointer, both in stage px.
 */
export function restoredUnderPointer(win: WindowState, drawn: Box, pointerX: number, stage: Stage): Box {
  if (win.mode === "normal" || !win.restore) return drawn;
  const w = win.restore.w * stage.width;
  const h = win.restore.h * stage.height;
  const at = drawn.w > 0 ? (pointerX - drawn.x) / drawn.w : 0;
  return { x: pointerX - at * w, y: drawn.y, w, h };
}
