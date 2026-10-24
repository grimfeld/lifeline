import { describe, expect, it } from "vitest";
import { defaultOverview, overviewOf } from "./overviews";
import type { WorkspaceRecord } from "./workspaces";

describe("defaultOverview", () => {
  it("lays two Cards to a row and a wide one alone", () => {
    const items = defaultOverview([
      { cardId: "x.a", title: "A" },
      { cardId: "x.b" },
      { cardId: "x.c" },
      { cardId: "x.d", wide: true },
    ]);
    expect(items.map(({ instanceId, x, y, w }) => ({ instanceId, x, y, w }))).toEqual([
      { instanceId: "default-0", x: 0, y: 0, w: 6 },
      { instanceId: "default-1", x: 6, y: 0, w: 6 },
      // A half row closes before a wide Card rather than sharing with it.
      { instanceId: "default-2", x: 0, y: 6, w: 6 },
      { instanceId: "default-3", x: 0, y: 12, w: 12 },
    ]);
    expect(items[0]!.title).toBe("A");
    expect(items[1]).not.toHaveProperty("title");
  });
});

describe("overviewOf", () => {
  const defaults = defaultOverview([{ cardId: "x.a" }]);
  const ws = (overviews?: WorkspaceRecord["overviews"]) =>
    ({ id: "w", name: "W", modules: [], sort: 0, updatedAt: "", deleted: 0, overviews }) as WorkspaceRecord;

  it("follows the default until the Workspace has its own", () => {
    expect(overviewOf(ws(), "money", defaults)).toEqual({ items: defaults, customised: false });
    expect(overviewOf(ws({ house: [] }), "money", defaults).customised).toBe(false);
  });

  it("an emptied Overview is still the user's own", () => {
    expect(overviewOf(ws({ money: [] }), "money", defaults)).toEqual({ items: [], customised: true });
  });
});
