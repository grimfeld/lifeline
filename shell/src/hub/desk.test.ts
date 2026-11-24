import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_LAYOUT, initApps, saveWindowLayout, windowsReducer } from "@lifeline/core";
import { deskReducer, initialLayout, nextHistoryIndex } from "./desk";

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
  it("loads a Workspace's set whole, and passes every other action to the window layout", () => {
    const l = deskReducer(EMPTY_LAYOUT, { type: "open", target: "map", route: "/map", stage: STAGE });
    expect(l.windows.map((w) => w.target)).toEqual(["map"]);
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

  it("with none, a full-screen page opens over the last place, never in a Window", () => {
    expect(initialLayout("w", "/settings", lastPlace).windows[0]).toMatchObject({ target: "calendar", route: "/calendar?view=week" });
    expect(initialLayout("w", "/base/task", () => "/settings")).toEqual(EMPTY_LAYOUT);
  });
});

describe("nextHistoryIndex", () => {
  it("reads the browser's index only for Back and Forward", () => {
    expect(nextHistoryIndex("POP", 3, 2)).toBe(2);
  });

  /** The race it exists for: a focus's replace at 3, Back to 2 before its effect runs. */
  it("keeps the index through a replace and adds one for a push, whatever the browser says by then", () => {
    expect(nextHistoryIndex("REPLACE", 3, 2)).toBe(3);
    expect(nextHistoryIndex("PUSH", 2, 1)).toBe(3);
  });

  it("starts from the browser's index when it has none of its own", () => {
    expect(nextHistoryIndex("PUSH", null, 4)).toBe(4);
    expect(nextHistoryIndex("REPLACE", null, null)).toBeNull();
  });
});
