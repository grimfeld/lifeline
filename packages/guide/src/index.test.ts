import { describe, expect, it } from "vitest";
import { GUIDE_PAGES, guideLink } from "./index";
import { guideBody } from "./pages";

const body = (slug: string) => guideBody(slug) ?? "";

describe("the Guide", () => {
  it("gives every page a title of its own, its first heading", () => {
    for (const p of GUIDE_PAGES) expect(/^# (.+)$/m.exec(body(p.slug))?.[1]?.trim(), p.slug).toBe(p.title);
    expect(new Set(GUIDE_PAGES.map((p) => p.title)).size).toBe(GUIDE_PAGES.length);
  });

  it("lists every page on its home", () => {
    const home = body("index");
    for (const p of GUIDE_PAGES.filter((p) => p.slug !== "index")) expect(home, p.slug).toContain(`(${p.slug}.md)`);
  });

  it("links only to pages that exist", () => {
    for (const p of GUIDE_PAGES) {
      for (const [, href] of body(p.slug).matchAll(/\]\(([^)\s]+\.md[^)\s]*)\)/g)) {
        expect(guideLink(href!), `${p.slug} → ${href}`).toBeDefined();
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
