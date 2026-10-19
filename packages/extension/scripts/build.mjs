#!/usr/bin/env node
// Builds the Lifeline extension into two loadable folders from one source:
//   dist/chrome   — Chrome-family browsers (Load unpacked)
//   dist/firefox  — Firefox (about:debugging → Load Temporary Add-on → manifest.json)
// Each script is bundled on its own as a classic script (IIFE) with Vite: a
// service worker, an event page and an injected file all load one of those.
import { build, runnerImport } from "vite";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const js = join(dist, ".js");

/** Output file → source entry. */
const ENTRIES = {
  "background.js": "src/background.ts",
  "reader.js": "src/inject.ts",
};

rmSync(dist, { recursive: true, force: true });
for (const [file, entry] of Object.entries(ENTRIES)) {
  await build({
    configFile: false,
    root,
    logLevel: "warn",
    build: {
      outDir: js,
      emptyOutDir: false,
      target: "es2022",
      minify: false,
      lib: { entry: join(root, entry), formats: ["iife"], name: "lifeline", fileName: () => file },
    },
  });
}

const { module: manifestModule } = await runnerImport(join(root, "src/manifest.ts"));
for (const browser of ["chrome", "firefox"]) {
  const out = join(dist, browser);
  mkdirSync(out, { recursive: true });
  for (const file of Object.keys(ENTRIES)) cpSync(join(js, file), join(out, file));
  // The icons (made from shell/public/icon-192.png).
  cpSync(join(root, "static"), out, { recursive: true });
  const manifest = manifestModule.manifest(browser);
  writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  // Every file the manifest names must be in the folder, or the browser refuses to load it.
  const named = [
    ...(manifest.background.service_worker ? [manifest.background.service_worker] : manifest.background.scripts),
    ...Object.values(manifest.icons),
    ...Object.values(manifest.action.default_icon),
  ];
  for (const file of named) if (!existsSync(join(out, file))) throw new Error(`${browser}: manifest names ${file}, which was not built`);
  console.log(`built ${browser} → ${out}`);
}
rmSync(js, { recursive: true, force: true });
