// Helpers for shell/playwright.config.ts, kept apart so node --test can reach them.
import { existsSync, linkSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir, totalmem } from "node:os";
import { join } from "node:path";

/** Where cloud containers ship their Chromium (and cannot download another). */
export const PW_BROWSERS = "/opt/pw-browsers";

/**
 * The UI checks (ADR 0129): specs about how screens look and read, run nightly at both
 * widths in their own projects, never in the delivery gate.
 */
export const UI_CHECK_SPECS = ["screens.spec.ts", "a11y-names.spec.ts"];
/**
 * Every spec the gate projects never run: the UI checks and the Demo. Read by
 * playwright.config.ts, scripts/e2e-widths.test.mjs and check.yml's e2e-plan.
 */
export const NIGHTLY_SPECS = [...UI_CHECK_SPECS, "demo.spec.ts"];

/**
 * Resolves whether nothing listens on `port` at `host`. A machine without that
 * address family (EADDRNOTAVAIL, or EAFNOSUPPORT where IPv6 is compiled out) has
 * nothing listening there either; any other error (EADDRINUSE, EACCES…) is busy.
 */
export const portFree = (port, host, listen = createServer) =>
  new Promise((resolve) => {
    const server = listen()
      .once("error", (e) => resolve(e.code === "EADDRNOTAVAIL" || e.code === "EAFNOSUPPORT"))
      .once("listening", () => server.close(() => resolve(true)))
      .listen(port, host);
  });

/** Whether nothing listens on `port`, on IPv4 or IPv6 localhost. */
export const free = (port) => Promise.all(["127.0.0.1", "::1"].map((host) => portFree(port, host))).then((all) => all.every(Boolean));

/**
 * The Chromium executable preinstalled under `dir`, or undefined when `dir` is
 * missing or holds none. Takes the newest `chromium-<build>` folder, whatever its
 * build, and the platform's executable inside it.
 */
export function preinstalledChromium(dir = PW_BROWSERS, platform = process.platform, exists = existsSync, list = readdirSync) {
  if (!exists(dir)) return undefined;
  const builds = list(dir)
    .map((name) => /^chromium-(\d+)$/.exec(name))
    .filter(Boolean)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  // Linux builds sit in chrome-linux, or chrome-linux64 in newer Playwright builds.
  const insides =
    platform === "darwin" ? [["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"]]
    : platform === "win32" ? [["chrome-win", "chrome.exe"]]
    : [["chrome-linux", "chrome"], ["chrome-linux64", "chrome"]];
  for (const [name] of builds) {
    for (const inside of insides) {
      const exe = join(dir, name, ...inside);
      if (exists(exe)) return exe;
    }
  }
  return undefined;
}

/**
 * How many e2e runs may share this machine at once (#596): `E2E_SLOTS` when set, `0` for no
 * limit; otherwise one per 5 GB of memory, at least one. Each run starts its own Vite server
 * (about 1.1 GB) and a Chromium per worker, and six at once on 15 GB ran out of memory.
 */
export function slotCount(env = process.env, memory = totalmem()) {
  const set = env.E2E_SLOTS?.trim();
  if (set) {
    const n = Number(set);
    if (!Number.isInteger(n) || n < 0) throw new Error(`E2E_SLOTS must be a whole number, 0 for no limit: got "${set}"`);
    return n;
  }
  return Math.max(1, Math.floor(memory / 5e9));
}

/** Whether process `pid` still runs (EPERM: it does, as another user's). */
function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === "EPERM";
  }
}

const slotFile = (dir, i) => join(dir, `slot-${i}.json`);
const readSlot = (file) => {
  try {
    const held = JSON.parse(readFileSync(file, "utf8"));
    return Number.isInteger(held?.pid) && held.pid > 0 && typeof held.worktree === "string" ? held : undefined;
  } catch {
    return undefined;
  }
};
/** A run's worktree as the waiting line shows it: printable characters only. */
const printable = (text) => text.replace(/[\u0000-\u001f\u007f-\u009f]/g, "?");

/**
 * Clears slot file `file` when the run in it is gone, or it isn't a lock at all (another
 * program's file, or one a crash left unreadable). Done under `<file>.reclaim`, a directory
 * only one run can create, so two runs that find the same dead lock can't both clear it and
 * then each take the slot; the lock is read again under it, in case a live run took the slot
 * since. A `.reclaim` older than a minute was left by a run killed mid-clear, and goes.
 */
function clearIfDead(file, isAlive, now = Date.now()) {
  const mutex = `${file}.reclaim`;
  try {
    if (now - statSync(mutex).mtimeMs > 60_000) rmSync(mutex, { recursive: true, force: true });
  } catch {
    // No mutex: the usual case.
  }
  try {
    mkdirSync(mutex);
  } catch {
    return; // Another run is clearing it.
  }
  try {
    const held = readSlot(file);
    if (existsSync(file) && (!held || !isAlive(held.pid))) rmSync(file, { force: true });
  } finally {
    rmSync(mutex, { recursive: true, force: true });
  }
}

/**
 * Takes the first free one of `count` slots in `dir`: a lock file holding the run's pid and
 * worktree. It is written whole under a name of this run's own, then linked in as the slot,
 * which fails when the slot is taken: no run ever sees a half-written lock. A lock whose
 * process is gone is free (`clearIfDead`). Returns `{ slot, release }`, or `{ holders }`
 * when every slot is taken.
 */
export function tryTakeSlot({ dir, count, pid = process.pid, worktree, isAlive = alive }) {
  mkdirSync(dir, { recursive: true });
  const mine = join(dir, `run-${pid}.json`);
  writeFileSync(mine, JSON.stringify({ pid, worktree }));
  const holders = [];
  try {
    for (let i = 0; i < count; i++) {
      const file = slotFile(dir, i);
      if (existsSync(file)) clearIfDead(file, isAlive);
      try {
        linkSync(mine, file);
        return {
          slot: i,
          release: () => {
            if (readSlot(file)?.pid === pid) rmSync(file, { force: true });
          },
        };
      } catch (e) {
        if (e.code !== "EEXIST") throw e;
        holders.push(readSlot(file) ?? { pid: 0, worktree: `${file} (unreadable; cleared on the next try)` });
      }
    }
    return { holders };
  } finally {
    rmSync(mine, { force: true });
  }
}

/**
 * Takes a slot, waiting while every one is taken: it says which runs hold them once, and
 * again only when that changes. Resolves to the slot, or undefined when `count` is 0. The
 * slot goes back when this process exits; a run killed outright leaves a lock its next
 * taker finds dead.
 */
export async function takeSlot({
  count,
  dir = join(tmpdir(), `lifeline-e2e-slots-${process.getuid?.() ?? "user"}`),
  worktree,
  pid = process.pid,
  isAlive = alive,
  log = (line) => console.log(line),
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  every = 3000,
}) {
  if (count === 0) return undefined;
  let said = "";
  for (;;) {
    const got = tryTakeSlot({ dir, count, pid, worktree, isAlive });
    if ("slot" in got) {
      process.once("exit", got.release);
      if (said) log(`e2e: slot ${got.slot + 1} of ${count} is free; starting`);
      return got.slot;
    }
    const line = got.holders.map((h) => `${printable(h.worktree)} (pid ${h.pid})`).sort().join(", ");
    if (line !== said) {
      log(`e2e: all ${count} slots are taken, by ${line}; waiting for one (E2E_SLOTS sets the count, shell/e2e/README.md)`);
      said = line;
    }
    await sleep(every);
  }
}
