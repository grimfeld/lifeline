import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MODULES, SURFACES, type AppManifest } from "@lifeline/core";
import { GUIDE_PAGES, guidePageOfModule, guidePageOfSurface } from "@lifeline/guide";
import { guideSlugForPath } from "./guidePlace";

/**
 * The Guide keeps up with the app (ADR 0089): a Module or Surface with no page,
 * an App no page answers for, or a Command or Card its page never names, fails
 * here — so a new feature is not done until the Guide says it exists.
 *
 * A deliberate omission goes in `UNLISTED` as "<app>/<title>", with the reason.
 */
const UNLISTED: Record<string, string> = {};

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

  it("opens on the page for where the user stands", () => {
    expect(guideSlugForPath("/module/money/budget")).toBe("money");
    expect(guideSlugForPath("/module/tasks")).toBe("projects");
    expect(guideSlugForPath("/calendar")).toBe("calendar");
    expect(guideSlugForPath("/base/task")).toBe("bases");
    expect(guideSlugForPath("/settings")).toBe("settings");
    expect(guideSlugForPath("/guide/house")).toBe("index");
  });
});
