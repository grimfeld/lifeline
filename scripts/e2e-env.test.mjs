// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtempSync, readdirSync as ls, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { portFree, preinstalledChromium, slotCount, takeSlot, tryTakeSlot } from "./e2e-env.mjs";

/** A server whose listen() fails with `code`, or succeeds when none. */
const fakeServer = (code) => () => {
  const s = new EventEmitter();
  s.listen = () => {
    queueMicrotask(() => (code ? s.emit("error", Object.assign(new Error(code), { code })) : s.emit("listening")));
    return s;
  };
  s.close = (cb) => cb();
  return s;
};

test("a port nothing listens on is free", async () => assert.equal(await portFree(1, "::1", fakeServer()), true));
test("EADDRNOTAVAIL (no such address) is free", async () => assert.equal(await portFree(1, "::1", fakeServer("EADDRNOTAVAIL")), true));
test("EAFNOSUPPORT (no IPv6) is free", async () => assert.equal(await portFree(1, "::1", fakeServer("EAFNOSUPPORT")), true));
test("EADDRINUSE is busy", async () => assert.equal(await portFree(1, "::1", fakeServer("EADDRINUSE")), false));

const fakeFs = (files) => ({
  exists: (p) => files.some((f) => f === p || f.startsWith(p + "/")),
  list: (dir) => [...new Set(files.filter((f) => f.startsWith(dir + "/")).map((f) => f.slice(dir.length + 1).split("/")[0]))],
});

test("finds the chromium build whatever its number", () => {
  const fs = fakeFs(["/pw/chromium-1243/chrome-linux/chrome", "/pw/chromium_headless_shell-1243/x", "/pw/ffmpeg-1011/y"]);
  assert.equal(preinstalledChromium("/pw", "linux", fs.exists, fs.list), "/pw/chromium-1243/chrome-linux/chrome");
});
test("takes the newest build", () => {
  const fs = fakeFs(["/pw/chromium-1243/chrome-linux/chrome", "/pw/chromium-1248/chrome-linux/chrome"]);
  assert.equal(preinstalledChromium("/pw", "linux", fs.exists, fs.list), join("/pw", "chromium-1248", "chrome-linux", "chrome"));
});
test("finds a linux build laid out as chrome-linux64, as newer Playwright builds are", () => {
  const fs = fakeFs(["/pw/chromium-1243/chrome-linux64/chrome"]);
  assert.equal(preinstalledChromium("/pw", "linux", fs.exists, fs.list), join("/pw", "chromium-1243", "chrome-linux64", "chrome"));
});
test("no directory, or no chromium in it, is undefined", () => {
  const none = fakeFs([]);
  assert.equal(preinstalledChromium("/pw", "linux", none.exists, none.list), undefined);
  const other = fakeFs(["/pw/ffmpeg-1011/y"]);
  assert.equal(preinstalledChromium("/pw", "linux", other.exists, other.list), undefined);
});

// Slots (#596): the temp directory and the "is this process alive" check are injected.

const GB = 1e9;
const slotDir = () => mkdtempSync(join(tmpdir(), "e2e-slots-test-"));

test("one slot per 5 GB, at least one; E2E_SLOTS overrides, 0 for no limit", () => {
  assert.equal(slotCount({}, 16.9 * GB), 3);
  assert.equal(slotCount({}, 4 * GB), 1);
  assert.equal(slotCount({ E2E_SLOTS: "5" }, 4 * GB), 5);
  assert.equal(slotCount({ E2E_SLOTS: "0" }, 16 * GB), 0);
  assert.throws(() => slotCount({ E2E_SLOTS: "two" }), /E2E_SLOTS/);
});

test("runs take free slots until none is left, then learn who holds them", () => {
  const dir = slotDir();
  const isAlive = () => true;
  assert.equal(tryTakeSlot({ dir, count: 2, pid: 11, worktree: "/a", isAlive }).slot, 0);
  assert.equal(tryTakeSlot({ dir, count: 2, pid: 12, worktree: "/b", isAlive }).slot, 1);
  assert.deepEqual(tryTakeSlot({ dir, count: 2, pid: 13, worktree: "/c", isAlive }).holders, [
    { pid: 11, worktree: "/a" },
    { pid: 12, worktree: "/b" },
  ]);
});

test("a released slot is free again", () => {
  const dir = slotDir();
  const first = tryTakeSlot({ dir, count: 1, pid: 11, worktree: "/a", isAlive: () => true });
  first.release();
  assert.equal(tryTakeSlot({ dir, count: 1, pid: 12, worktree: "/b", isAlive: () => true }).slot, 0);
});

test("the slot of a run that died is taken back without waiting, and nothing is left aside", () => {
  const dir = slotDir();
  tryTakeSlot({ dir, count: 1, pid: 11, worktree: "/a", isAlive: () => true });
  const got = tryTakeSlot({ dir, count: 1, pid: 12, worktree: "/b", isAlive: (pid) => pid !== 11 });
  assert.equal(got.slot, 0);
  assert.deepEqual(ls(dir), ["slot-0.json"]);
});

test("a file in a slot that is no lock (a crash, another program) is cleared, not waited on forever", () => {
  const dir = slotDir();
  writeFileSync(join(dir, "slot-0.json"), "");
  assert.equal(tryTakeSlot({ dir, count: 1, pid: 12, worktree: "/b", isAlive: () => true }).slot, 0);
});

test("a live run's lock is never cleared, and a run's release leaves another run's lock alone", () => {
  const dir = slotDir();
  const first = tryTakeSlot({ dir, count: 1, pid: 11, worktree: "/a", isAlive: () => true });
  assert.ok("holders" in tryTakeSlot({ dir, count: 1, pid: 12, worktree: "/b", isAlive: () => true }));
  // Run 11 died and run 12 took its slot; 11's release, late, must not free 12's slot.
  tryTakeSlot({ dir, count: 1, pid: 12, worktree: "/b", isAlive: (pid) => pid !== 11 });
  first.release();
  assert.equal(JSON.parse(readFileSync(join(dir, "slot-0.json"), "utf8")).pid, 12);
});

test("a run clearing a dead lock holds the slot's reclaim lock: another run finding it leaves the slot alone", () => {
  const dir = slotDir();
  tryTakeSlot({ dir, count: 1, pid: 11, worktree: "/a", isAlive: () => true });
  writeFileSync(join(dir, "slot-0.json.reclaim"), ""); // stands in for the other run's mutex
  const got = tryTakeSlot({ dir, count: 1, pid: 12, worktree: "/b", isAlive: (pid) => pid !== 11 });
  assert.deepEqual(got.holders, [{ pid: 11, worktree: "/a" }]);
});

test("a waiting run says who holds the slots once, again when that changes, and starts when one frees", async () => {
  const dir = slotDir();
  const live = new Set([11]);
  tryTakeSlot({ dir, count: 1, pid: 11, worktree: "/a", isAlive: (pid) => live.has(pid) });
  const lines = [];
  let polls = 0;
  const sleep = async () => {
    polls++;
    if (polls === 2) {
      // The holder finishes; another run takes its slot before this one looks again.
      live.delete(11);
      live.add(12);
      tryTakeSlot({ dir, count: 1, pid: 12, worktree: "/b", isAlive: (pid) => live.has(pid) });
    }
    if (polls === 4) live.delete(12); // that one dies
  };
  live.add(13);
  const slot = await takeSlot({ dir, count: 1, pid: 13, worktree: "/c", isAlive: (pid) => live.has(pid), log: (l) => lines.push(l), sleep });
  assert.equal(slot, 0);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /all 1 slots are taken, by \/a \(pid 11\)/);
  assert.match(lines[1], /\/b \(pid 12\)/);
  assert.match(lines[2], /slot 1 of 1 is free/);
});

test("no limit: takeSlot takes nothing and never waits", async () => {
  assert.equal(await takeSlot({ count: 0, worktree: "/a", sleep: () => assert.fail("waited") }), undefined);
});
