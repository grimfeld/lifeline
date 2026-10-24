// node --test scripts/*.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** No App imports another (ADR 0001); the one exception is named in ADR 0100. */
const ALLOWED = new Set(["projects -> tasks"]);

const apps = fileURLToPath(new URL("../apps", import.meta.url));
const files = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === "node_modules" || e.name.startsWith(".") ? [] : files(join(dir, e.name))) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : [],
  );

const pkgName = (app) => JSON.parse(readFileSync(join(apps, app, "package.json"), "utf8")).name;
const appDirs = readdirSync(apps, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
const byPkg = new Map(appDirs.map((a) => [pkgName(a), a]));

test("no App imports another, but for ADR 0100's exception", () => {
  const hits = [];
  for (const app of appDirs) {
    const pkg = JSON.parse(readFileSync(join(apps, app, "package.json"), "utf8"));
    for (const dep of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies })) {
      const other = byPkg.get(dep);
      if (other && other !== app && !ALLOWED.has(`${app} -> ${other}`)) hits.push(`apps/${app}/package.json: ${dep}`);
    }
    for (const f of files(join(apps, app, "src"))) {
      readFileSync(f, "utf8")
        .split("\n")
        .forEach((l, i) => {
          for (const [, dep] of l.matchAll(/from\s+["'](@lifeline\/app-[\w-]+)/g)) {
            const other = byPkg.get(dep);
            if (other && other !== app && !ALLOWED.has(`${app} -> ${other}`)) hits.push(`${f.slice(apps.length + 1)}:${i + 1}: ${dep}`);
          }
        });
    }
  }
  assert.deepEqual(hits, [], "Apps work together through Core Contracts, never by importing each other (ADR 0001, 0100). Shared code goes in packages/parts.");
});
