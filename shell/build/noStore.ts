/**
 * The e2e dev server's responses, never cached by the browser (LIFELINE_E2E_NO_STORE,
 * set by playwright.config.ts).
 *
 * The layout tests open dozens of pages in one browser context, each loading a few
 * hundred source modules that Vite marks `no-cache` (revalidate every time) or
 * `immutable`. Chromium 156 (Playwright 1.64) stalls its HTTP cache after some
 * thousands of those: every request of the next page waits in the cache, none
 * reaches a socket, and the page never loads. Its headless shell has no switch to
 * turn the cache off, so the server tells it not to store anything: Vite sets
 * Cache-Control on each response itself, so the header is rewritten as it is set.
 */
import type { Plugin } from "vite";

export function noStorePlugin(): Plugin {
  return {
    name: "lifeline-e2e-no-store",
    apply: "serve",
    configureServer(server) {
      if (process.env.LIFELINE_E2E_NO_STORE !== "1") return;
      server.middlewares.use((_req, res, next) => {
        const setHeader = res.setHeader.bind(res);
        res.setHeader = (name, value) => setHeader(name, name.toLowerCase() === "cache-control" ? "no-store" : value);
        setHeader("Cache-Control", "no-store");
        next();
      });
    },
  };
}
