// node --test scripts/*.test.mjs
//
// A gate spec picks its width by a tag on the case, never by itself (ADR 0129): the
// desktop project runs every case not tagged `@phone`, the mobile project only cases
// tagged `@phone` or `@also-phone` (shell/playwright.config.ts). The nightly specs set
// both widths themselves and are exempt.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../shell/e2e", import.meta.url));
/** The nightly-only specs (NIGHTLY_ONLY in playwright.config.ts). */
const NIGHTLY = new Set(["screens.spec.ts", "a11y-names.spec.ts", "demo.spec.ts"]);
const gateSpecs = () => readdirSync(root).filter((f) => f.endsWith(".spec.ts") && !NIGHTLY.has(f));

/** Each `file:line` where `text` (a gate spec's source) picks its width itself. */
export function widthPicks(file, text) {
  const lines = text.split("\n");
  const hits = [];
  const width = /isMobile|viewport|project\.name/;
  lines.forEach((l, i) => {
    // A skip, fixme or fail whose condition reads the width or the project.
    if (/\btest(\.describe)?\.(skip|fixme|fail)\s*\(/.test(l) && width.test(l)) hits.push(`${file}:${i + 1} skips by width`);
    else if (/!\s*isMobile/.test(l)) hits.push(`${file}:${i + 1} reads !isMobile`);
  });
  // A case may still act on its width (a tap or a click), but only a case that runs at both.
  if (/isMobile|viewportSize\(|\bviewport\b/.test(text) && !text.includes("@also-phone"))
    hits.push(`${file} reads its width, but has no @also-phone case for it to tell apart`);
  return hits;
}

test("a gate spec picks its width by tag, never by a skip or a width check", () => {
  const hits = gateSpecs().flatMap((f) => widthPicks(f, readFileSync(join(root, f), "utf8")));
  assert.deepEqual(
    hits,
    [],
    'A gate case runs at desktop width; tag it { tag: "@phone" } to run at phone width only, or { tag: "@also-phone" } for both (shell/e2e/README.md § Widths). Delete a test.skip(isMobile): the desktop project already runs the case alone.',
  );
});

test("widthPicks finds a width skip, a !isMobile and an untagged width branch", () => {
  assert.deepEqual(widthPicks("a.spec.ts", 'test("x", async ({ isMobile }) => {\n  test.skip(isMobile, "desk");\n});'), [
    "a.spec.ts:2 skips by width",
    "a.spec.ts reads its width, but has no @also-phone case for it to tell apart",
  ]);
  assert.deepEqual(widthPicks("b.spec.ts", "test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024);"), ["b.spec.ts:1 skips by width", "b.spec.ts reads its width, but has no @also-phone case for it to tell apart"]);
  assert.deepEqual(widthPicks("c.spec.ts", "if (!isMobile) await x();"), ["c.spec.ts:1 reads !isMobile", "c.spec.ts reads its width, but has no @also-phone case for it to tell apart"]);
  assert.deepEqual(widthPicks("d.spec.ts", 'test("x", { tag: "@also-phone" }, async ({ isMobile }) => {\n  if (isMobile) await tap();\n});'), []);
  assert.deepEqual(widthPicks("e.spec.ts", 'test("x", { tag: "@phone" }, async ({ page }) => {});'), []);
});
