import { describe, expect, it } from "vitest";
import { GUIDE_PAGES, guideLink, guidePage } from "./index";

describe("the Guide", () => {
  it("gives every page a title of its own", () => {
    for (const p of GUIDE_PAGES) expect(p.body, p.slug).toMatch(/^# .+/m);
    expect(new Set(GUIDE_PAGES.map((p) => p.title)).size).toBe(GUIDE_PAGES.length);
  });

  it("lists every page on its home", () => {
    const home = guidePage("index")!.body;
    for (const p of GUIDE_PAGES.filter((p) => p.slug !== "index")) expect(home, p.slug).toContain(`(${p.slug}.md)`);
  });

  it("links only to pages that exist", () => {
    for (const p of GUIDE_PAGES) {
      for (const [, href] of p.body.matchAll(/\]\(([^)\s]+\.md[^)\s]*)\)/g)) {
        expect(guideLink(href), `${p.slug} → ${href}`).toBeDefined();
      }
    }
  });

  it("reads a page link with or without ./", () => {
    expect(guideLink("calendar.md")).toBe("calendar");
    expect(guideLink("./calendar.md")).toBe("calendar");
    expect(guideLink("calendar.md#tips")).toBeUndefined();
    expect(guideLink("nowhere.md")).toBeUndefined();
    expect(guideLink("https://example.com")).toBeUndefined();
  });
});
