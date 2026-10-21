import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MODULES, SURFACES, type AppManifest } from "@lifeline/core";
import { GUIDE_PAGES, guidePageOfModule, guidePageOfSurface } from "@lifeline/guide";
import { CORE_PAGES, guideSlugForPath } from "./guidePlace";

/**
 * The Guide keeps up with the app (ADR 0089): a Module or Surface with no page,
 * an App no page answers for, or a Command or Card its page never names, fails
 * here — so a new feature is not done until the Guide says it exists.
 *
 * A deliberate omission goes in `UNLISTED` as "<app>/<title>", with the reason.
 */
const UNLISTED: Record<string, string> = {};

/**
 * Routes with no page of their own, by path as `App.tsx` declares it (params cut
 * off), with the reason. A route is a Core concept's screen: a new one needs a
 * page, so it lands in `CORE_PAGES` (guidePlace.ts) — or here.
 */
const UNLISTED_ROUTES: Record<string, string> = {
  "/guide": "the Guide itself; its pages are its content",
  "/module": "a Module's page, found by the Module the path is in (guidePageOfModule)",
};

let APPS: AppManifest[] = [];

// The registry as the browser loads it, views and all: a DOM first, so the
// browser-only libraries load (as build/intakes.test.ts does).
beforeAll(async () => {
  const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/" });
  for (const name of ["window", "document", "navigator", "HTMLElement", "Element"] as const) vi.stubGlobal(name, name === "window" ? window : window[name]);
  ({ APPS } = await import("../apps"));
}, 180_000);

/** A title as a page names it: "Add movie…" is named "Add movie". */
const named = (title: string) => title.replace(/…$/, "").trim().toLowerCase();

describe("the Guide", () => {
  it("has a page for every Module and every Surface", () => {
    for (const m of MODULES) expect(guidePageOfModule(m.id), m.id).toBeDefined();
    for (const s of SURFACES) expect(guidePageOfSurface(s.id), s.id).toBeDefined();
  });

  it("answers for every App on exactly one page", () => {
    for (const a of APPS) expect(GUIDE_PAGES.filter((p) => p.apps.includes(a.id)).map((p) => p.slug), a.id).toHaveLength(1);
  });

  it("names every Command and Card of an App on its page", () => {
    const missing: string[] = [];
    for (const page of GUIDE_PAGES) {
      const body = page.body.toLowerCase();
      for (const id of page.apps) {
        const app = APPS.find((a) => a.id === id);
        expect(app, `${page.slug} answers for an App that does not exist: ${id}`).toBeDefined();
        const titles = [...(app!.commands ?? []), ...(app!.cards ?? [])].map((x) => x.title);
        for (const t of titles) {
          if (!body.includes(named(t)) && !(`${id}/${t}` in UNLISTED)) missing.push(`${page.slug}.md: ${id} "${t}"`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("has a page for every route: a new Core screen is not done until the Guide has its page", () => {
    // Routes declared in App.tsx as literals; redirects, frames and constants are not screens.
    const source = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
    const routes = [...source.matchAll(/<Route\s+[^>]*?path="(\/[^"]*)"[^>]*?element=\{([^\n]*)\}/g)]
      .filter(([, , element]) => !/Redirect|Navigate/.test(element))
      .map(([, path]) => path.split("/").filter((s) => s && !s.startsWith(":") && s !== "*").map((s) => "/" + s).join(""))
      .filter((path) => path);
    expect(routes.length, "found no routes in App.tsx: has this test's reading of it broken?").toBeGreaterThan(5);

    for (const [root, slug] of CORE_PAGES) expect(GUIDE_PAGES.map((p) => p.slug), `CORE_PAGES sends ${root} to a page that does not exist`).toContain(slug);

    const owned = [...CORE_PAGES.map(([root]) => root), ...SURFACES.map((s) => s.path)];
    const missing = [...new Set(routes)].filter((r) => !owned.includes(r) && !(r in UNLISTED_ROUTES));
    expect(
      missing,
      `These routes have no Guide page of their own: ${missing.join(", ")}. A new Core screen or concept needs one: ` +
        "write packages/guide/pages/<slug>.md (packages/guide/AUTHORING.md), add it to ENTRIES in packages/guide/src/index.ts " +
        "and link it from index.md, then point the route at it in CORE_PAGES (shell/src/guide/guidePlace.ts). " +
        "If it deliberately has none, add it to UNLISTED_ROUTES in shell/src/guide/guide.test.ts with the reason.",
    ).toEqual([]);
  });

  it("opens on the page for where the user stands", () => {
    expect(guideSlugForPath("/module/money/budget")).toBe("money");
    expect(guideSlugForPath("/module/tasks")).toBe("projects");
    expect(guideSlugForPath("/calendar")).toBe("calendar");
    expect(guideSlugForPath("/base/task")).toBe("bases");
    expect(guideSlugForPath("/settings")).toBe("settings");
    expect(guideSlugForPath("/guide/house")).toBe("index");
  });
});
