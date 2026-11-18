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
import { NIGHTLY_SPECS } from "./e2e-env.mjs";

const root = fileURLToPath(new URL("../shell/e2e", import.meta.url));
const gateSpecs = () => readdirSync(root).filter((f) => f.endsWith(".spec.ts") && !NIGHTLY_SPECS.includes(f));

const WIDTH = /isMobile|viewportSize\(|\bviewport\b|project\.name/;
const CASE = /^(\s*)test(\.describe)?(\.serial|\.only|\.parallel)?\(/;

/** Each `file:line` where `text` (a gate spec's source) picks its width itself. */
export function widthPicks(file, text) {
  const lines = text.split("\n");
  const hits = [];
  /** The cases and describes around the current line: their indent, and whether they run at both widths. */
  const open = [];
  lines.forEach((l, i) => {
    const at = `${file}:${i + 1}`;
    const indent = l.length - l.trimStart().length;
    const isCase = CASE.exec(l);
    // A new case, describe or top-level helper closes every block at its indent or deeper.
    if (l.trim() && !/^[})\]]/.test(l.trim()) && (isCase || indent === 0)) while (open.length && open.at(-1).indent >= indent) open.pop();
    if (isCase) {
      // The header runs to its arrow, which may sit a line or two down.
      const header = lines.slice(i, i + 3).join(" ").split("=>")[0];
      open.push({ indent, both: header.includes("@also-phone") || open.some((b) => b.both) });
    }
    // A skip, fixme or fail whose condition (on its line or the next) reads the width or the project.
    if (/\btest(\.describe)?\.(skip|fixme|fail)\s*\(/.test(l) && WIDTH.test(l + lines[i + 1])) hits.push(`${at} skips by width`);
    else if (/!\s*isMobile/.test(l)) hits.push(`${at} reads !isMobile`);
    // A case may still act on its width (a tap or a click), but only one that runs at both.
    else if (WIDTH.test(l) && open.length && !open.at(-1).both) hits.push(`${at} reads its width outside an @also-phone case`);
  });
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

test("widthPicks finds a width skip, a !isMobile and a width read outside an @also-phone case", () => {
  assert.deepEqual(widthPicks("a.spec.ts", 'test("x", async ({ page }) => {\n  test.skip(isMobile, "desk");\n});'), ["a.spec.ts:2 skips by width"]);
  assert.deepEqual(widthPicks("b.spec.ts", 'test.describe("y", () => {\n  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024);\n});'), ["b.spec.ts:2 skips by width"]);
  assert.deepEqual(widthPicks("c.spec.ts", 'test("x", async ({ page }) => {\n  test.skip(\n    isMobile,\n  );\n});'), ["c.spec.ts:2 skips by width", "c.spec.ts:3 reads its width outside an @also-phone case"]);
  assert.deepEqual(widthPicks("d.spec.ts", 'test("x", { tag: "@also-phone" }, async ({ isMobile }) => {\n  if (!isMobile) await click();\n});'), ["d.spec.ts:2 reads !isMobile"]);
  // One case at both widths does not excuse its untagged neighbour.
  const mixed = [
    'test("both", { tag: "@also-phone" }, async ({ page, isMobile }) => {',
    "  if (isMobile) await tap();",
    "});",
    "",
    'test("desk", async ({ page }) => {',
    "  if (page.viewportSize()!.width < 768) await tap();",
    "});",
  ].join("\n");
  assert.deepEqual(widthPicks("e.spec.ts", mixed), ["e.spec.ts:6 reads its width outside an @also-phone case"]);
  // A describe at both widths covers its cases; a @phone case runs at one width and has nothing to tell apart.
  assert.deepEqual(widthPicks("f.spec.ts", 'test.describe("d", { tag: "@also-phone" }, () => {\n  test("x", async ({ isMobile }) => {\n    if (isMobile) await tap();\n  });\n});'), []);
  assert.deepEqual(widthPicks("g.spec.ts", 'test("x", { tag: "@phone" }, async ({ page, isMobile }) => {\n  if (isMobile) await tap();\n});'), ["g.spec.ts:1 reads its width outside an @also-phone case", "g.spec.ts:2 reads its width outside an @also-phone case"]);
  // A helper outside any case is the caller's business.
  assert.deepEqual(widthPicks("h.spec.ts", 'test("x", async ({ page }) => {});\nasync function open(page, isMobile) {\n  if (isMobile) await tap();\n}'), []);
});
