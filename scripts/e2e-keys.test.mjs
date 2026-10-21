// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../shell/e2e", import.meta.url).pathname;
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === "node_modules" || e.name.startsWith(".") ? [] : files(join(dir, e.name))) : /\.(ts|tsx|mjs)$/.test(e.name) ? [join(dir, e.name)] : [],
  );

test("no e2e spec presses ControlOrMeta", () => {
  const hits = files(root).flatMap((f) =>
    readFileSync(f, "utf8").split("\n").flatMap((l, i) => (l.includes("ControlOrMeta") ? [`${f.slice(root.length + 1)}:${i + 1}`] : [])),
  );
  assert.deepEqual(
    hits,
    [],
    "The desktop project uses the Desktop Chrome device (Windows user agent), so the app listens for Control; ControlOrMeta presses Cmd on a Mac host and the spec fails there. Press Control (and open the palette with openPalette).",
  );
});
