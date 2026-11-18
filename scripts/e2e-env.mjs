// Helpers for shell/playwright.config.ts, kept apart so node --test can reach them.
import { existsSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

/** Where cloud containers ship their Chromium (and cannot download another). */
export const PW_BROWSERS = "/opt/pw-browsers";

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
  // Newer builds name the Linux folder chrome-linux64; older ones chrome-linux.
  const layouts =
    platform === "darwin" ? [["chrome-mac", "Chromium.app", "Contents", "MacOS", "Chromium"]]
    : platform === "win32" ? [["chrome-win", "chrome.exe"]]
    : [["chrome-linux", "chrome"], ["chrome-linux64", "chrome"]];
  for (const [name] of builds) {
    for (const inside of layouts) {
      const exe = join(dir, name, ...inside);
      if (exists(exe)) return exe;
    }
  }
  return undefined;
}
