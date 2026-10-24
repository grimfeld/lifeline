import type { Page } from "@playwright/test";
import { CORE_URL } from "./seed";

/** What the page's Core module offers: the callback's `core`. */
export type Core = typeof import("@lifeline/core");

/**
 * Runs `fn` in the page against the app's own Core module. The callback is serialised, so it
 * cannot close over anything: pass what it needs as `arg`.
 */
export async function inCore<A, R>(page: Page, fn: (core: Core, arg: A) => Promise<R>, arg: A): Promise<R> {
  return page.evaluate(
    async ({ coreUrl, src, arg }) => {
      const core = await import(/* @vite-ignore */ coreUrl);
      return new Function("core", "arg", `return (${src})(core, arg);`)(core, arg);
    },
    { coreUrl: CORE_URL, src: fn.toString(), arg },
  );
}
