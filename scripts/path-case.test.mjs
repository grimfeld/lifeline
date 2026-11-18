// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * The names a case-insensitive disk (macOS, Windows) can't tell apart: two tracked
 * paths equal but for case, or two modules in one folder whose import names
 * ("./BlockTiming", "./blockTiming") are. On such a disk an import resolves to
 * whichever file it meets first, so the app, tsc and knip break there while Linux
 * CI stays green.
 */
export function caseClashes(paths) {
  const groups = new Map();
  const add = (key, name) => groups.set(key, new Set([...(groups.get(key) ?? []), name]));
  for (const p of paths) {
    add(`path:${p.toLowerCase()}`, p);
    const module = p.replace(/\.(ts|tsx|js|jsx|mjs|cjs)$/, "");
    if (module !== p) add(`module:${module.toLowerCase()}`, module);
  }
  return [...groups.values()].filter((names) => names.size > 1).map((names) => [...names].sort().join(" ~ "));
}

test("caseClashes finds paths and import names that differ only in case", () => {
  assert.deepEqual(caseClashes(["a/BlockTiming.tsx", "a/blockTiming.ts", "a/Foo.md", "a/foo.md", "a/Bar.tsx", "a/Bar.css", "a/x.test.ts", "a/x.ts"]), [
    "a/BlockTiming ~ a/blockTiming",
    "a/Foo.md ~ a/foo.md",
  ]);
});

test("no two tracked files differ only in case, as paths or as import names", () => {
  const paths = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual(
    caseClashes(paths),
    [],
    "On a case-insensitive disk (macOS) these are one name: an import picks the wrong file and the app, tsc and knip break there, though Linux CI passes. Rename one of each pair so the names differ by more than case.",
  );
});
