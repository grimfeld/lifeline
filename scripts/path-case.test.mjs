// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * The names a case-insensitive disk (macOS, Windows) can't tell apart, each clash
 * once: two folders, or two files, or a code module's import name ("./BlockTiming",
 * "./blockTiming", whatever the extensions) and another name in the same folder,
 * equal but for case. On such a disk they are one name, so an import resolves to
 * whichever it meets first: the app, tsc and knip break there while Linux CI stays green.
 */
export function caseClashes(paths) {
  const spellings = new Map();
  const add = (name) => {
    const key = name.toLowerCase();
    if (!spellings.has(key)) spellings.set(key, new Set());
    spellings.get(key).add(name);
  };
  for (const p of paths) {
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) add(parts.slice(0, i).join("/"));
    // A code file is reached by its import name, so that is the name that must not clash.
    add(p.replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/, ""));
  }
  return [...spellings.values()].filter((names) => names.size > 1).map((names) => [...names].sort().join(" ~ ")).sort();
}

test("caseClashes finds folders, files and import names that differ only in case, each once", () => {
  assert.deepEqual(
    caseClashes([
      "a/BlockTiming.tsx", "a/blockTiming.ts", // import names, different extensions
      "a/Same.ts", "a/same.ts", // whole paths: reported once, by import name
      "a/Foo.md", "a/foo.md",
      "a/Peek/x.ts", "a/peek/y.ts", // folders
      "a/Mod.mts", "a/mod.ts",
      "a/Bar.tsx", "a/Bar.css", "a/x.test.ts", "a/x.ts", "b/Bar.tsx", // not clashes
    ]),
    ["a/BlockTiming ~ a/blockTiming", "a/Foo.md ~ a/foo.md", "a/Mod ~ a/mod", "a/Peek ~ a/peek", "a/Same ~ a/same"],
  );
});

test("no two tracked folders, files or import names differ only in case", () => {
  const paths = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
  assert.deepEqual(
    caseClashes(paths),
    [],
    "On a case-insensitive disk (macOS) these are one name: an import picks the wrong file and the app, tsc and knip break there, though Linux CI passes. Rename one of each pair so the names differ by more than case.",
  );
});
