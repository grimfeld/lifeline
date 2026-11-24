import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BAR_HEIGHT,
  BAR_KEEP,
  CASCADE_STEP,
  EMPTY_LAYOUT,
  MIN_HEIGHT,
  MIN_WIDTH,
  OPEN_SIZE,
  boxInPixels,
  clampBox,
  snapZone,
  SNAP_EDGE,
  LEFT_HALF,
  RIGHT_HALF,
  restoredUnderPointer,
  frontWindow,
  isPageTarget,
  pageTarget,
  pathOnly,
  recordRoute,
  stepRoute,
  SCREENS_TARGET,
  loadWindowLayout,
  newDesk,
  routeTarget,
  saveWindowLayout,
  windowsReducer,
  type Box,
  type WindowAction,
  type WindowLayout,
} from "./windows";
import { initApps } from "./registry";
import type { AppManifest } from "./manifest";

initApps([
  {
    id: "library",
    title: "library",
    module: "culture",
    types: [],
    screens: [{ id: "library", title: "library", path: "library", component: () => null }],
    cards: [],
    commands: [],
  } satisfies AppManifest,
  // An App with no Module: its screens are full-screen pages on the desk (the Calendar App's Events).
  {
    id: "events",
    title: "events",
    types: [],
    screens: [{ id: "events", title: "events", path: "events", component: () => null }],
    cards: [],
    commands: [],
  } satisfies AppManifest,
]);

const STAGE = { width: 1200, height: 800 };
const run = (layout: WindowLayout, ...actions: WindowAction[]) => actions.reduce(windowsReducer, layout);
const open = (target: string, route = `/${target}`, stage = STAGE): WindowAction => ({ type: "open", target, route, stage });
const ids = (l: WindowLayout) => l.windows.map((w) => w.id);

describe("opening", () => {
  it("centres the first Window at the open size", () => {
    const l = run(EMPTY_LAYOUT, open("tasks"));
    expect(l.windows).toHaveLength(1);
    expect(l.windows[0]!).toMatchObject({ id: "tasks:1", target: "tasks", route: "/tasks", mode: "normal" });
    const b = l.windows[0]!.box;
    expect(b.w).toBeCloseTo(OPEN_SIZE);
    expect(b.x).toBeCloseTo((1 - OPEN_SIZE) / 2);
    expect(l.lastOpened).toBe("tasks:1");
  });

  it("focuses an open target with the new route instead of a second Window", () => {
    const a = run(EMPTY_LAYOUT, open("tasks"), open("notes"));
    const l = run(a, open("tasks", "/tasks/42"));
    expect(ids(l)).toEqual(["notes:1", "tasks:1"]);
    expect(frontWindow(l)?.route).toBe("/tasks/42");
  });

  it("cascades each new Window from the last opened", () => {
    const l = run(EMPTY_LAYOUT, open("a"), open("b"), open("c"));
    const [a, b, c] = l.windows.map((w) => w.box) as [Box, Box, Box];
    expect(b.x - a.x).toBeCloseTo(CASCADE_STEP);
    expect(b.y - a.y).toBeCloseTo(CASCADE_STEP);
    expect(c.x - b.x).toBeCloseTo(CASCADE_STEP);
    expect(l.lastOpened).toBe("c:1");
  });

  it("wraps the cascade back to the top-left when it would leave the stage", () => {
    let l = EMPTY_LAYOUT;
    for (let i = 0; i < 20; i++) l = run(l, open(`t${i}`));
    for (const w of l.windows) {
      expect(w.box.x + w.box.w).toBeLessThanOrEqual(1 + 1e-9);
      expect(w.box.y + w.box.h).toBeLessThanOrEqual(1 + 1e-9);
    }
    const xs = l.windows.map((w) => w.box.x);
    expect(Math.min(...xs.slice(1))).toBeCloseTo(CASCADE_STEP);
    expect(xs.some((x, i) => i > 0 && x < (xs[i - 1] ?? 0))).toBe(true);
  });
});

describe("focus, route, close", () => {
  it("moves a Window to the front", () => {
    const l = run(EMPTY_LAYOUT, open("a"), open("b"), { type: "focus", id: "a:1" });
    expect(ids(l)).toEqual(["b:1", "a:1"]);
  });

  it("sets a route", () => {
    const l = run(EMPTY_LAYOUT, open("a"), { type: "route", id: "a:1", route: "/a/x?q=1#h" });
    expect(l.windows[0]!.route).toBe("/a/x?q=1#h");
  });

  it("keeps the box on close, drops the route, and reopens there on the home route", () => {
    const placed = run(EMPTY_LAYOUT, open("a"), open("b"), {
      type: "place",
      id: "a:1",
      box: { x: 0.1, y: 0.1, w: 0.3, h: 0.5 },
      stage: STAGE,
    });
    const box = placed.windows.find((w) => w.id === "a:1")!.box;
    const closed = run(placed, { type: "close", id: "a:1" });
    expect(ids(closed)).toEqual(["b:1"]);
    expect(closed.remembered.a).toEqual(box);
    expect(JSON.stringify(closed)).not.toContain("/a/deep");
    const reopened = run(closed, open("a", "/a"));
    expect(reopened.windows.find((w) => w.target === "a")).toMatchObject({ box, route: "/a", mode: "normal" });
  });

  it("remembers the restore box of a maximised Window", () => {
    const l = run(EMPTY_LAYOUT, open("a"));
    const box = l.windows[0]!.box;
    const closed = run(l, { type: "maximise", id: "a:1" }, { type: "close", id: "a:1" });
    expect(closed.remembered.a).toEqual(box);
  });
});

describe("maximise", () => {
  it("maximises and goes back to the box it had", () => {
    const l = run(EMPTY_LAYOUT, open("a"));
    const box = l.windows[0]!.box;
    const max = run(l, { type: "maximise", id: "a:1" });
    expect(max.windows[0]!).toMatchObject({ mode: "maximised", restore: box });
    expect(boxInPixels(max.windows[0]!, STAGE)).toEqual({ x: 0, y: 0, w: 1200, h: 800 });
    const back = run(max, { type: "maximise", id: "a:1" });
    expect(back.windows[0]!).toMatchObject({ mode: "normal", box });
    expect(back.windows[0]!.restore).toBeUndefined();
  });

  it("place leaves a maximised Window normal at the new box", () => {
    const l = run(EMPTY_LAYOUT, open("a"), { type: "maximise", id: "a:1" }, {
      type: "place",
      id: "a:1",
      box: { x: 0.2, y: 0.2, w: 0.5, h: 0.5 },
      stage: STAGE,
    });
    expect(l.windows[0]!).toMatchObject({ mode: "normal", box: { x: 0.2, y: 0.2, w: 0.5, h: 0.5 } });
    expect(l.windows[0]!.restore).toBeUndefined();
  });
});

describe("clampBox", () => {
  it("keeps a minimum size in pixels, never above the stage", () => {
    const b = clampBox({ x: 0.1, y: 0.1, w: 0.01, h: 0.01 }, STAGE);
    expect(b.w * STAGE.width).toBeCloseTo(MIN_WIDTH);
    expect(b.h * STAGE.height).toBeCloseTo(MIN_HEIGHT);
    const small = clampBox({ x: 0, y: 0, w: 0.1, h: 0.1 }, { width: 200, height: 150 });
    expect(small.w).toBe(1);
    expect(small.h).toBe(1);
  });

  it("keeps BAR_KEEP px of the bar on the stage horizontally", () => {
    const right = clampBox({ x: 5, y: 0.1, w: 0.5, h: 0.5 }, STAGE);
    expect(right.x * STAGE.width).toBeCloseTo(STAGE.width - BAR_KEEP);
    const left = clampBox({ x: -5, y: 0.1, w: 0.5, h: 0.5 }, STAGE);
    expect(left.x * STAGE.width).toBeCloseTo(BAR_KEEP - 0.5 * STAGE.width);
  });

  it("keeps the bar's top on the stage vertically", () => {
    const up = clampBox({ x: 0.1, y: -1, w: 0.5, h: 0.5 }, STAGE);
    expect(up.y).toBe(0);
    const down = clampBox({ x: 0.1, y: 9, w: 0.5, h: 0.5 }, STAGE);
    expect(down.y * STAGE.height).toBeCloseTo(STAGE.height - BAR_HEIGHT);
  });

  it("leaves a fine box alone", () => {
    const box = { x: 0.1, y: 0.2, w: 0.5, h: 0.5 };
    expect(clampBox(box, STAGE)).toEqual(box);
  });
});

describe("fractions", () => {
  it("keep their proportions when drawn on another stage", () => {
    const l = run(EMPTY_LAYOUT, open("a"));
    const win = l.windows[0]!;
    const big = boxInPixels(win, { width: 2400, height: 1600 });
    const small = boxInPixels(win, { width: 1200, height: 800 });
    expect(big.x / 2400).toBeCloseTo(small.x / 1200);
    expect(big.w / 2400).toBeCloseTo(small.w / 1200);
    expect(big.h / 1600).toBeCloseTo(small.h / 800);
    expect(big.w).toBeCloseTo(2 * small.w);
  });

  it("round-trip: a box placed on one stage reads back the same on a resize", () => {
    const placed = run(EMPTY_LAYOUT, open("a"), { type: "place", id: "a:1", box: { x: 0.25, y: 0.1, w: 0.5, h: 0.6 }, stage: STAGE });
    const px = boxInPixels(placed.windows[0]!, STAGE);
    const other = { width: 1800, height: 1000 };
    const again = run(placed, { type: "place", id: "a:1", box: { x: px.x / STAGE.width, y: px.y / STAGE.height, w: px.w / STAGE.width, h: px.h / STAGE.height }, stage: other });
    expect(again.windows[0]!.box).toEqual(placed.windows[0]!.box);
  });
});

describe("prune", () => {
  it("drops Windows of absent targets and keeps what is remembered", () => {
    const l = run(EMPTY_LAYOUT, open("a"), open("b"), { type: "close", id: "a:1" }, open("a"), { type: "prune", targets: ["b"] });
    expect(ids(l)).toEqual(["b:1"]);
    expect(l.remembered.a).toBeDefined();
  });
});

describe("newDesk", () => {
  it("is one maximised Window restoring to the centred open box", () => {
    const l = newDesk("tasks", "/tasks");
    expect(l.windows).toHaveLength(1);
    expect(l.windows[0]!.mode).toBe("maximised");
    expect(l.windows[0]!.restore?.w).toBeCloseTo(OPEN_SIZE);
    expect(l.windows[0]!.restore?.x).toBeCloseTo((1 - OPEN_SIZE) / 2);
  });
});

describe("storage per Workspace", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("saves under the Workspace's own key and loads it back", () => {
    const l = run(EMPTY_LAYOUT, open("a"));
    saveWindowLayout("w1", l);
    expect([...store.keys()]).toEqual(["lifeline:windows:w1"]);
    expect(loadWindowLayout("w1")).toEqual(l);
    expect(loadWindowLayout("w2")).toBeNull();
  });

  it("drops a page's Window a layout saved before full-screen pages still holds", () => {
    const l = run(EMPTY_LAYOUT, open("a"), open("page:settings", "/settings"));
    saveWindowLayout("w1", l);
    expect(loadWindowLayout("w1")?.windows.map((w) => w.target)).toEqual(["a"]);
  });

  it("keeps full screen, and the mode it goes back to, across a reload", () => {
    const l = run(EMPTY_LAYOUT, open("a"), { type: "maximise", id: "a:1" }, { type: "fullScreen", id: "a:1" });
    saveWindowLayout("w1", l);
    expect(loadWindowLayout("w1")).toEqual(l);
    store.set("lifeline:windows:w1", JSON.stringify({ ...l, windows: [{ ...l.windows[0], was: "full" }] }));
    expect(loadWindowLayout("w1")).toBeNull();
  });

  it("refuses a stored route that leaves the app", () => {
    for (const route of ["//evil.example", "https://evil.example", "evil"]) {
      const l = run(EMPTY_LAYOUT, open("a"));
      store.set("lifeline:windows:w", JSON.stringify({ ...l, windows: [{ ...l.windows[0]!, route }] }));
      expect(loadWindowLayout("w")).toBeNull();
    }
  });

  it("returns null for unreadable or misshapen data", () => {
    store.set("lifeline:windows:w", "{nope");
    expect(loadWindowLayout("w")).toBeNull();
    store.set("lifeline:windows:w", JSON.stringify({ windows: [{ id: 1 }], remembered: {} }));
    expect(loadWindowLayout("w")).toBeNull();
    store.set("lifeline:windows:w", JSON.stringify({ windows: [], remembered: { a: { x: "no" } } }));
    expect(loadWindowLayout("w")).toBeNull();
  });

  it("is null without localStorage, and a failing store does not throw", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(loadWindowLayout("w")).toBeNull();
    expect(() => saveWindowLayout("w", EMPTY_LAYOUT)).not.toThrow();
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(loadWindowLayout("w")).toBeNull();
    expect(() => saveWindowLayout("w", EMPTY_LAYOUT)).not.toThrow();
  });
});

describe("routeTarget", () => {
  it("sends a Module's home and its App screens to the Module's window", () => {
    expect(routeTarget("/module/tasks")).toEqual({ kind: "window", target: "tasks" });
  });

  it("sends an App screen inside a Module to that Module", () => {
    expect(routeTarget("/app/library/shelf/42")).toEqual({ kind: "window", target: "culture" });
  });

  it("sends a Surface to its own window", () => {
    expect(routeTarget("/calendar")).toEqual({ kind: "window", target: "calendar" });
    expect(routeTarget("/map/x")).toEqual({ kind: "window", target: "map" });
  });

  it("sends a user Screen to the Screens window", () => {
    expect(routeTarget("/screens")).toEqual({ kind: "window", target: "screens" });
    expect(routeTarget("/screen/abc")).toEqual({ kind: "window", target: "screens" });
  });

  it("sends anything else to a page keyed by its first segment", () => {
    expect(routeTarget("/settings/macros")).toEqual({ kind: "page", target: "page:settings" });
    expect(routeTarget("/")).toEqual({ kind: "page", target: "page:" });
  });
});

describe("pages", () => {
  it("are page targets by their first segment", () => {
    expect(pageTarget("settings")).toBe("page:settings");
    expect(isPageTarget("page:settings")).toBe(true);
    expect(isPageTarget("culture")).toBe(false);
    expect(routeTarget("/settings/keys")).toEqual({ kind: "page", target: "page:settings" });
    expect(routeTarget("/screen/abc")).toEqual({ kind: "window", target: SCREENS_TARGET });
  });

  it("are never Windows: prune drops one a layout saved before still holds", () => {
    const l = run(EMPTY_LAYOUT, open("culture"), open("page:base", "/base"), { type: "prune", targets: ["culture"] });
    expect(l.windows.map((w) => w.target)).toEqual(["culture"]);
  });
});

describe("route to Window or full-screen page", () => {
  it.each([
    ["/module/culture", { kind: "window", target: "culture" }],
    ["/app/library/shelf", { kind: "window", target: "culture" }],
    ["/calendar", { kind: "window", target: "calendar" }],
    ["/screens", { kind: "window", target: SCREENS_TARGET }],
    ["/screen/abc", { kind: "window", target: SCREENS_TARGET }],
    ["/base", { kind: "page", target: "page:base" }],
    ["/base/task", { kind: "page", target: "page:base" }],
    ["/vault/d/abc", { kind: "page", target: "page:vault" }],
    ["/settings/keys", { kind: "page", target: "page:settings" }],
    ["/guide/hub", { kind: "page", target: "page:guide" }],
    ["/app/events", { kind: "page", target: "page:app" }],
    ["/nowhere/at/all", { kind: "page", target: "page:nowhere" }],
  ] as const)("%s", (path, expected) => {
    expect(routeTarget(path)).toEqual(expected);
  });
});

describe("full screen", () => {
  const fs = (id: string): WindowAction => ({ type: "fullScreen", id });

  it("from a normal Window, and back to its box", () => {
    const l = run(EMPTY_LAYOUT, open("a"));
    const box = l.windows[0]!.box;
    const full = run(l, fs("a:1"));
    expect(full.windows[0]).toMatchObject({ mode: "full", was: "normal", restore: box });
    expect(boxInPixels(full.windows[0]!, STAGE)).toEqual({ x: 0, y: 0, w: 1200, h: 800 });
    expect(run(full, fs("a:1")).windows[0]).toEqual(l.windows[0]);
  });

  it("from a maximised or snapped Window, back to that mode with its box before the snap kept", () => {
    const l = run(EMPTY_LAYOUT, open("a"));
    const box = l.windows[0]!.box;
    const max = run(l, { type: "maximise", id: "a:1" });
    expect(run(max, fs("a:1"), fs("a:1")).windows[0]).toEqual(max.windows[0]);
    const snapped = run(l, { type: "snap", id: "a:1", box: LEFT_HALF });
    const back = run(snapped, fs("a:1"), fs("a:1")).windows[0]!;
    expect(back).toEqual(snapped.windows[0]);
    expect(back.restore).toEqual(box);
  });

  it("is left by a snap, and maximise does nothing to it", () => {
    const l = run(EMPTY_LAYOUT, open("a"));
    const box = l.windows[0]!.box;
    const full = run(l, fs("a:1"));
    expect(run(full, { type: "maximise", id: "a:1" })).toEqual(full);
    const snapped = run(full, { type: "snap", id: "a:1", box: RIGHT_HALF }).windows[0]!;
    expect(snapped).toEqual({ id: "a:1", target: "a", route: "/a", mode: "snapped", box: RIGHT_HALF, restore: box });
  });

  it("goes with the Window when it closes, which remembers its own box", () => {
    const l = run(EMPTY_LAYOUT, open("a"), open("b"));
    const box = l.windows[1]!.box;
    const closed = run(l, fs("b:1"), { type: "close", id: "b:1" });
    expect(frontWindow(closed)?.id).toBe("a:1");
    expect(frontWindow(closed)?.mode).toBe("normal");
    expect(closed.remembered.b).toEqual(box);
  });
});

describe("a Window's own history", () => {
  it("records navigations, drops the forward entries on a new one, and replaces in place", () => {
    let h = recordRoute(undefined, "/a", false);
    h = recordRoute(h, "/a/1", false);
    h = recordRoute(h, "/a/2", false);
    expect(h).toEqual({ entries: ["/a", "/a/1", "/a/2"], index: 2 });
    expect(recordRoute(h, "/a/2", false)).toBe(h);
    const back = stepRoute(h, -1)!;
    expect(back.route).toBe("/a/1");
    expect(recordRoute(back.history, "/a/3", false)).toEqual({ entries: ["/a", "/a/1", "/a/3"], index: 2 });
    expect(recordRoute(back.history, "/a/x", true)).toEqual({ entries: ["/a", "/a/x", "/a/2"], index: 1 });
  });

  it("steps Back and Forward within itself, and has nowhere to go past either end", () => {
    const h = recordRoute(recordRoute(undefined, "/a", false), "/a/1", false);
    expect(stepRoute(h, -1)?.route).toBe("/a");
    expect(stepRoute(h, 1)).toBeUndefined();
    expect(stepRoute(stepRoute(h, -1)!.history, -1)).toBeUndefined();
    expect(stepRoute(stepRoute(h, -1)!.history, 3)?.route).toBe("/a/1");
    expect(stepRoute(undefined, -1)).toBeUndefined();
  });

  it("pathOnly drops the search and the hash", () => {
    expect(pathOnly("/a/b?x=1#h")).toBe("/a/b");
    expect(pathOnly("/")).toBe("/");
  });
});

describe("snapZone", () => {
  const S = { width: 1000, height: 800 };
  it("the left and right edges fill a half", () => {
    expect(snapZone({ x: 5, y: 400 }, S)).toEqual(LEFT_HALF);
    expect(snapZone({ x: 995, y: 400 }, S)).toEqual(RIGHT_HALF);
  });
  it("the outer 30% of the left, right and top edges fill a quarter, from either edge", () => {
    const tl = { x: 0, y: 0, w: 0.5, h: 0.5 };
    expect(snapZone({ x: 5, y: 100 }, S)).toEqual(tl);
    expect(snapZone({ x: 100, y: 5 }, S)).toEqual(tl);
    expect(snapZone({ x: 995, y: 100 }, S)).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
    expect(snapZone({ x: 900, y: 5 }, S)).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
    expect(snapZone({ x: 5, y: 700 }, S)).toEqual({ x: 0, y: 0.5, w: 0.5, h: 0.5 });
    expect(snapZone({ x: 995, y: 700 }, S)).toEqual({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 });
  });
  it("the top edge's middle maximises", () => {
    expect(snapZone({ x: 500, y: 5 }, S)).toBe("max");
  });
  it("the middle of the stage, and the bottom edge's middle, snap nothing", () => {
    expect(snapZone({ x: 500, y: 400 }, S)).toBeNull();
    expect(snapZone({ x: 500, y: 795 }, S)).toBeNull();
  });
  it("draws the lines at exactly 28px and 30%", () => {
    expect(snapZone({ x: SNAP_EDGE - 0.5, y: 400 }, S)).toEqual(LEFT_HALF);
    expect(snapZone({ x: SNAP_EDGE, y: 400 }, S)).toBeNull();
    expect(snapZone({ x: 5, y: 239 }, S)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 });
    expect(snapZone({ x: 5, y: 240 }, S)).toEqual(LEFT_HALF);
    expect(snapZone({ x: 299, y: 5 }, S)).toEqual({ x: 0, y: 0, w: 0.5, h: 0.5 });
    expect(snapZone({ x: 300, y: 5 }, S)).toBe("max");
    // The right edge, the bottom-corner line and the top edge's right line.
    expect(snapZone({ x: 972, y: 400 }, S)).toBeNull();
    expect(snapZone({ x: 972.5, y: 400 }, S)).toEqual(RIGHT_HALF);
    expect(snapZone({ x: 5, y: 560 }, S)).toEqual(LEFT_HALF);
    expect(snapZone({ x: 5, y: 561 }, S)).toEqual({ x: 0, y: 0.5, w: 0.5, h: 0.5 });
    expect(snapZone({ x: 700, y: 5 }, S)).toBe("max");
    expect(snapZone({ x: 701, y: 5 }, S)).toEqual({ x: 0.5, y: 0, w: 0.5, h: 0.5 });
  });
});

describe("snapping", () => {
  const own = (l: WindowLayout) => l.windows[0]!;
  it("snaps, keeps the first pre-snap box from zone to zone, and restores it", () => {
    const opened = run(EMPTY_LAYOUT, open("a"));
    const box = own(opened).box;
    const left = run(opened, { type: "snap", id: "a:1", box: LEFT_HALF });
    expect(own(left)).toMatchObject({ mode: "snapped", box: LEFT_HALF, restore: box });
    const right = run(left, { type: "snap", id: "a:1", box: RIGHT_HALF });
    expect(own(right)).toMatchObject({ mode: "snapped", box: RIGHT_HALF, restore: box });
    expect(own(run(right, { type: "restore", id: "a:1", stage: STAGE }))).toMatchObject({ mode: "normal", box, restore: undefined });
  });
  it("a top-middle drop maximises, keeping the pre-snap box", () => {
    const opened = run(EMPTY_LAYOUT, open("a"));
    const box = own(opened).box;
    const max = run(opened, { type: "snap", id: "a:1", box: LEFT_HALF }, { type: "snap", id: "a:1", box: "max" });
    expect(own(max)).toMatchObject({ mode: "maximised", restore: box });
    expect(own(run(max, { type: "restore", id: "a:1", stage: STAGE }))).toMatchObject({ mode: "normal", box });
  });
  it("maximise from snapped keeps the pre-snap box, and maximise again restores it", () => {
    const opened = run(EMPTY_LAYOUT, open("a"));
    const box = own(opened).box;
    const max = run(opened, { type: "snap", id: "a:1", box: LEFT_HALF }, { type: "maximise", id: "a:1" });
    expect(own(max)).toMatchObject({ mode: "maximised", restore: box });
    expect(own(run(max, { type: "maximise", id: "a:1" }))).toMatchObject({ mode: "normal", box });
  });

  it("the double-click toggle: a normal Window maximises; a maximised or snapped one restores to the pre-snap box", () => {
    const opened = run(EMPTY_LAYOUT, open("a"));
    const box = own(opened).box;
    const toggle: WindowAction = { type: "toggle", id: "a:1", stage: STAGE };
    const max = run(opened, toggle);
    expect(own(max)).toMatchObject({ mode: "maximised", restore: box });
    expect(own(run(max, toggle))).toMatchObject({ mode: "normal", box });
    expect(own(run(opened, { type: "snap", id: "a:1", box: RIGHT_HALF }, toggle))).toMatchObject({ mode: "normal", box });
  });

  it("a restored box keeps the limits on a stage that shrank since the snap", () => {
    const opened = run(EMPTY_LAYOUT, open("a", "/a", { width: 2000, height: 1600 }));
    const small = { width: 500, height: 400 };
    const back = own(run(opened, { type: "snap", id: "a:1", box: LEFT_HALF }, { type: "restore", id: "a:1", stage: small }));
    expect(back.box.w * small.width).toBeGreaterThanOrEqual(MIN_WIDTH);
    expect(back.box.h * small.height).toBeGreaterThanOrEqual(MIN_HEIGHT);
  });

  it("dragged away, a snapped Window takes back its size under the same point of the bar", () => {
    const opened = run(EMPTY_LAYOUT, open("a"));
    const snapped = own(run(opened, { type: "snap", id: "a:1", box: LEFT_HALF }));
    const drawn = { x: 0, y: 0, w: STAGE.width / 2, h: STAGE.height };
    const box = restoredUnderPointer(snapped, drawn, drawn.w / 4, STAGE);
    expect(box.w).toBeCloseTo(snapped.restore!.w * STAGE.width);
    expect((drawn.w / 4 - box.x) / box.w).toBeCloseTo(0.25);
    expect(restoredUnderPointer(own(opened), drawn, 10, STAGE)).toBe(drawn);
  });

  it("a manual place clears the pre-snap box; restore does nothing to a normal Window", () => {
    const snapped = run(EMPTY_LAYOUT, open("a"), { type: "snap", id: "a:1", box: LEFT_HALF });
    const placed = run(snapped, { type: "place", id: "a:1", box: { x: 0.1, y: 0.1, w: 0.4, h: 0.4 }, stage: STAGE });
    expect(own(placed).mode).toBe("normal");
    expect(own(placed).restore).toBeUndefined();
    expect(run(placed, { type: "restore", id: "a:1", stage: STAGE })).toEqual(placed);
  });
});
