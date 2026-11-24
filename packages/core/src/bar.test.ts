import { describe, expect, it } from "vitest";
import { BAR_CUSTOM_SLOTS, BAR_PINNED, barToStore, resolveBar, sameSlot, seedBar } from "./bar";
import { SURFACES } from "./manifest";
import type { UserScreen } from "./data/db";

describe("the Phone bar's pinned slots", () => {
  it("is the Calendar Surface alone (ADR 0063: Calendar and Schedule are one)", () => {
    expect(BAR_PINNED.map((s) => s.id)).toEqual(["calendar"]);
  });

  /**
   * The point of ADR 0053: the time Surfaces belong to no Module, so under ADR 0049's
   * derivation they could never have taken a slot at all.
   */
  it("pins Surfaces that no Module could have supplied", () => {
    for (const s of BAR_PINNED) expect(SURFACES).toContain(s);
  });
});

describe("seeding a new Workspace's bar", () => {
  it("prefers Tasks and Note-taking when the Workspace holds them", () => {
    const bar = seedBar(["house", "tasks", "schedules", "notes", "money"]);
    expect(bar).toEqual([
      { kind: "module", id: "tasks" },
      { kind: "module", id: "notes" },
    ]);
  });

  /**
   * A focused Workspace must not be seeded with a Module it does not hold: the
   * slot would resolve to nothing, since `ModulePage` turns such a Module away.
   */
  it("falls back to the Workspace's own order when it holds neither", () => {
    expect(seedBar(["money", "house", "culture"])).toEqual([
      { kind: "module", id: "money" },
      { kind: "module", id: "house" },
    ]);
  });

  it("takes what it can when the Workspace holds only one of them", () => {
    expect(seedBar(["house", "notes"])).toEqual([
      { kind: "module", id: "notes" },
      { kind: "module", id: "house" },
    ]);
  });

  /** #664: two slots, both seeded — left of capture, then right of it. */
  it("seeds both of the user's slots", () => {
    const bar = seedBar(["house", "tasks", "schedules", "culture", "money", "notes", "progress"]);
    expect(bar).toHaveLength(BAR_CUSTOM_SLOTS);
    expect(barToStore(bar)).toEqual(bar);
  });

  it("gives a Workspace holding nothing an empty bar rather than inventing one", () => {
    expect(seedBar([])).toEqual([]);
  });
});

describe("comparing slots", () => {
  it("matches on kind and id, ignoring the label", () => {
    expect(sameSlot({ kind: "module", id: "tasks" }, { kind: "module", id: "tasks", label: "To do" })).toBe(true);
  });

  it("does not confuse a Surface with a Module of the same id", () => {
    expect(sameSlot({ kind: "surface", id: "schedule" }, { kind: "module", id: "schedule" })).toBe(false);
  });

  it("is false for an empty slot on either side", () => {
    expect(sameSlot(null, null)).toBe(false);
    expect(sameSlot({ kind: "module", id: "tasks" }, null)).toBe(false);
  });
});

describe("storing an arrangement", () => {
  const tasks = { kind: "module" as const, id: "tasks" };
  const notes = { kind: "module" as const, id: "notes" };

  it("is two slots the user arranges, beside the fixed Calendar, capture and Hub (#664)", () => {
    expect(BAR_CUSTOM_SLOTS).toBe(2);
  });

  /**
   * The decision this test exists to pin (ADR 0053): a slot whose destination
   * is gone **empties in place**. Compacting the holes out on the way to disk
   * would slide the second slot into the first on the next read — the bar
   * rearranging itself under the thumb, which is the whole thing the rule
   * forbids.
   */
  it("keeps a hole rather than closing it up", () => {
    expect(barToStore([null, tasks])).toEqual([null, tasks]);
  });

  it("pads a short arrangement to the bar's length", () => {
    expect(barToStore([])).toEqual([null, null]);
    expect(barToStore([tasks])).toEqual([tasks, null]);
  });

  /** #664: a bar stored with three slots keeps its first two, and saving it drops the third. */
  it("drops a third slot stored before #664 the next time the bar is saved", () => {
    const old = [tasks, notes, { kind: "screen" as const, id: "s1" }];
    expect(barToStore(old)).toEqual([tasks, notes]);
  });

  it("round-trips: what is stored reads back in the same positions", () => {
    const arrangement = [null, { kind: "screen" as const, id: "s1", label: "Morning" }];
    expect(barToStore(barToStore(arrangement))).toEqual(arrangement);
  });
});

describe("resolving the bar", () => {
  const tasks = { kind: "module" as const, id: "tasks" };
  const notes = { kind: "module" as const, id: "notes" };
  const screen = (id: string): UserScreen => ({ id, name: `Screen ${id}`, layout: [], sort: 0, workspace: "w", updatedAt: "", deleted: 0 });

  it("reads two slots, left of capture then right of it, and ignores a stored third", () => {
    const bar = resolveBar([tasks, notes, { kind: "screen", id: "s1" }], ["tasks", "notes"], [screen("s1")]);
    expect(bar).toHaveLength(2);
    expect(bar.map((s) => s?.slot.id)).toEqual(["tasks", "notes"]);
  });

  /** ADR 0053, kept: gone is empty, never refilled by what comes after it. */
  it("leaves a slot whose destination is gone empty, in place", () => {
    const bar = resolveBar([{ kind: "screen", id: "deleted" }, notes], ["tasks", "notes"], []);
    expect(bar[0]).toBeNull();
    expect(bar[1]?.slot).toEqual(notes);
    // A Module the Workspace no longer holds is gone too.
    expect(resolveBar([tasks, notes], ["notes"], [])[0]).toBeNull();
  });
});
