// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { join } from "node:path";
import { portFree, preinstalledChromium } from "./e2e-env.mjs";

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
test("no directory, or no chromium in it, is undefined", () => {
  const none = fakeFs([]);
  assert.equal(preinstalledChromium("/pw", "linux", none.exists, none.list), undefined);
  const other = fakeFs(["/pw/ffmpeg-1011/y"]);
  assert.equal(preinstalledChromium("/pw", "linux", other.exists, other.list), undefined);
});
