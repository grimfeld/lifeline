import { afterEach, describe, expect, it, vi } from "vitest";
import { closePeek, onPeekClosed, openPeek, pushPeek, backPeek, type HoursTapped, type TimingChange, type WorkOnHours, type TimedItem } from "@lifeline/core";
import { blockVisit, timedVisit, type BlockOps } from "./peekVisit";

/** The placement operations, recorded: a block made gets an id of its own. */
function fakeOps() {
  let n = 0;
  const ops = {
    add: vi.fn(async () => `block-${++n}`),
    move: vi.fn(async () => undefined),
    unplace: vi.fn(async () => undefined),
    complete: vi.fn(async () => undefined),
    remove: vi.fn(async () => async () => undefined),
    failed: vi.fn(),
  } satisfies BlockOps;
  return ops;
}

/** Close the Peek and hand back the timing changes it leaves for its one Undo. */
function closeForUndo(): TimingChange[] {
  let got: TimingChange[] = [];
  const off = onPeekClosed((c) => (got = c));
  closePeek();
  off();
  return got;
}

afterEach(() => closePeek());

describe("a Peek visit keeps its Time block timing across a link and Back (F1)", () => {
  const chip: WorkOnHours = { appId: "tasks", itemId: "t1", title: "Write", date: "2026-11-10", displayDate: "2026-11-10", estimateMin: 30 };

  it("a chip given a time, left and returned to, nudges the block it made — one block, and the Undo unplaces it", async () => {
    const ops = fakeOps();
    const tapped: HoursTapped = { kind: "work", item: chip };
    openPeek("task-doc", { tapped });

    const first = blockVisit(tapped, "2026-11-09", ops);
    first.write({ ...first.time, start: "10:00" });
    await first.settled();

    // Following a link unmounts the timing section; Back mounts it again.
    pushPeek("other-doc");
    backPeek();

    const again = blockVisit(tapped, "2026-11-09", ops);
    expect(again.time.start).toBe("10:00");
    expect(again.hasBlock).toBe(true);
    again.write({ ...again.time, start: "10:15" });
    await again.settled();

    expect(ops.add).toHaveBeenCalledTimes(1);
    expect(ops.move).toHaveBeenCalledWith("block-1", "2026-11-10", { start: "10:15", end: "10:45" });

    const changes = closeForUndo();
    expect(changes).toHaveLength(1);
    await changes[0]?.restore();
    expect(ops.unplace).toHaveBeenCalledWith("block-1");
  });

  it("a block moved, left and returned to, shows its new time and its Undo puts back the first", async () => {
    const ops = fakeOps();
    const block: WorkOnHours = { ...chip, placementId: "p1", start: "09:00", end: "10:00" };
    const tapped: HoursTapped = { kind: "work", item: block };
    openPeek("task-doc", { tapped });

    blockVisit(tapped, "2026-11-09", ops).write({ date: "2026-11-10", start: "09:15", len: 60 });
    pushPeek("other-doc");
    backPeek();
    const again = blockVisit(tapped, "2026-11-09", ops);
    expect(again.time.start).toBe("09:15");
    again.write({ ...again.time, start: "09:30" });
    await again.settled();

    const changes = closeForUndo();
    expect(changes.map((c) => [c.before, c.after])).toEqual([[{ date: "2026-11-10", start: "09:00", end: "10:00" }, { date: "2026-11-10", start: "09:30", end: "10:30" }]]);
    await changes[0]?.restore();
    expect(ops.move).toHaveBeenLastCalledWith("p1", "2026-11-10", { start: "09:00", end: "10:00" });
    expect(ops.add).not.toHaveBeenCalled();
  });

  it("starts afresh once the Peek has closed", () => {
    const ops = fakeOps();
    const tapped: HoursTapped = { kind: "work", item: chip };
    openPeek("task-doc", { tapped });
    blockVisit(tapped, "2026-11-09", ops).write({ date: "2026-11-10", start: "10:00", len: 30 });
    closePeek();
    expect(blockVisit(tapped, "2026-11-09", ops).time.start).toBeNull();
  });
});

describe("a Peek visit keeps its Timed item's time across a link and Back (F1)", () => {
  const session: TimedItem = { key: "workout/s", appId: "workout", itemId: "s", title: "Run", date: "2026-11-10", start: "07:00", end: "08:00" };

  it("a Timed item moved, left and returned to, shows its new time; the Undo puts back the first", async () => {
    const put = vi.fn(async () => undefined);
    const tapped: HoursTapped = { kind: "timed", item: session };
    openPeek("session-doc", { tapped });

    const first = timedVisit(tapped);
    first.write({ ...first.when, start: "07:15", end: "08:15" }, put);
    pushPeek("other-doc");
    backPeek();

    const again = timedVisit(tapped);
    expect(again.when).toEqual({ date: "2026-11-10", start: "07:15", endDate: "2026-11-10", end: "08:15" });
    again.write({ ...again.when, start: "07:30", end: "08:30" }, put);
    await again.settled();

    const changes = closeForUndo();
    expect(changes).toHaveLength(1);
    await changes[0]?.restore();
    expect(put).toHaveBeenLastCalledWith({ date: "2026-11-10", start: "07:00", endDate: "2026-11-10", end: "08:00" });
  });
});

describe("a Peek visit completes its item by id (F2)", () => {
  const occurrence: WorkOnHours = { appId: "tasks", itemId: "t1@2026-11-10", title: "Water", date: "2026-11-10", displayDate: "2026-11-10", estimateMin: 30 };

  it("completes the tapped item id, after the writes queued so far, and the visit then reads as completed", async () => {
    const ops = fakeOps();
    const tapped: HoursTapped = { kind: "work", item: occurrence };
    openPeek("task-doc", { tapped });
    const visit = blockVisit(tapped, "2026-11-09", ops);
    expect(visit.completed).toBe(false);
    visit.write({ ...visit.time, start: "10:00" });
    expect(await visit.complete()).toBe(true);
    expect(ops.add).toHaveBeenCalledTimes(1);
    expect(ops.complete).toHaveBeenCalledWith("tasks", "t1@2026-11-10");
    expect(blockVisit(tapped, "2026-11-09", ops).completed, "still so after a link and Back").toBe(true);
  });

  it("a failed completion leaves the visit not completed", async () => {
    const ops = fakeOps();
    ops.complete.mockRejectedValueOnce(new Error("no"));
    const tapped: HoursTapped = { kind: "work", item: occurrence };
    openPeek("task-doc", { tapped });
    const visit = blockVisit(tapped, "2026-11-09", ops);
    expect(await visit.complete()).toBe(false);
    expect(visit.completed).toBe(false);
  });
});
