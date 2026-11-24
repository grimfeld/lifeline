import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_LAYOUT, initApps, saveWindowLayout, windowsReducer, type WindowLayout } from "@lifeline/core";
import { deskReducer, initialLayout } from "./desk";

initApps([]);
const STAGE = { width: 1000, height: 800 };
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
});
afterEach(() => vi.unstubAllGlobals());

const lastPlace = () => "/calendar?view=week";

describe("deskReducer", () => {
  it("drops a page Window when another comes to the front, by opening or by focus", () => {
    let l: WindowLayout = deskReducer(EMPTY_LAYOUT, { type: "open", target: "map", route: "/map", stage: STAGE });
    l = deskReducer(l, { type: "open", target: "page:settings", route: "/settings", stage: STAGE });
    expect(l.windows.map((w) => w.target)).toEqual(["map", "page:settings"]);
    expect(deskReducer(l, { type: "focus", id: "map:1" }).windows.map((w) => w.target)).toEqual(["map"]);
    expect(deskReducer(l, { type: "open", target: "graph", route: "/graph", stage: STAGE }).windows.map((w) => w.target)).toEqual(["map", "graph"]);
  });

  it("keeps the page through other actions, and loads a set whole", () => {
    const l = deskReducer(deskReducer(EMPTY_LAYOUT, { type: "open", target: "map", route: "/map", stage: STAGE }), { type: "open", target: "page:base", route: "/base", stage: STAGE });
    expect(deskReducer(l, { type: "route", id: "page:base:1", route: "/base/task" }).windows).toHaveLength(2);
    const other = windowsReducer(EMPTY_LAYOUT, { type: "open", target: "graph", route: "/graph", stage: STAGE });
    expect(deskReducer(l, { type: "load", layout: other })).toBe(other);
  });
});

describe("initialLayout", () => {
  it("prefers the Workspace's saved desk", () => {
    const saved = windowsReducer(EMPTY_LAYOUT, { type: "open", target: "graph", route: "/graph", stage: STAGE });
    saveWindowLayout("w", saved);
    expect(initialLayout("w", "/map", lastPlace)).toEqual(saved);
  });

  it("with none, opens the address asked for as one maximised Window", () => {
    const l = initialLayout("w", "/map?z=3", lastPlace);
    expect(l.windows).toHaveLength(1);
    expect(l.windows[0]).toMatchObject({ target: "map", route: "/map?z=3", mode: "maximised" });
  });

  it("with none, `/` opens the last place", () => {
    expect(initialLayout("w", "/", lastPlace).windows[0]).toMatchObject({ target: "calendar", route: "/calendar?view=week", mode: "maximised" });
  });
});
