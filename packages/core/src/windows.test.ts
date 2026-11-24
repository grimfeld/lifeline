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
  dropPagesBehind,
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

  it("go when another Window comes to the front, and stay while in front", () => {
    const withPage = run(EMPTY_LAYOUT, open("culture"), open("page:settings", "/settings"));
    expect(dropPagesBehind(withPage)).toBe(withPage);
    const behind = run(withPage, { type: "focus", id: "culture:1" });
    expect(dropPagesBehind(behind).windows.map((w) => w.target)).toEqual(["culture"]);
  });

  it("are never pruned: they belong to no Workspace", () => {
    const l = run(EMPTY_LAYOUT, open("culture"), open("page:base", "/base"), { type: "prune", targets: ["money"] });
    expect(l.windows.map((w) => w.target)).toEqual(["page:base"]);
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
