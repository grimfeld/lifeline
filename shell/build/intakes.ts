/**
 * The published Intakes list (ADR 0080): `/intakes.json`, every Intake in the
 * App registry (key, title), written at build time so the Lifeline extension's
 * menu names a new Intake without an extension release.
 *
 * The registry is the real one, src/apps.ts, read in Node: Vite bundles it
 * for the server (every package compiled in, stylesheets dropped), and the
 * bundle is imported to read `intakesOf(APPS)`. Nothing is rendered, so the
 * Apps' views only have to load: the view-only libraries, some of which touch
 * `window` the moment they load, are swapped for an inert stand-in — the
 * list is the MCP server build's too (mcp/scripts/browser-only.mjs).
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build, type Plugin } from "vite";
import { INTAKES_PATH, type IntakeEntry } from "@lifeline/handoff";
import { BROWSER_ONLY } from "../../mcp/scripts/browser-only.mjs";

const shell = resolve(import.meta.dirname, "..");
const ENTRY = "lifeline-intake-list";

// The stand-in for the view-only libraries: the MCP build's own (inert.cjs). Being CommonJS,
// every named import is a property read at run time, which returns it again — Rolldown
// (Vite 8) has no synthetic named exports for an ES module stand-in to hand them out.
const INERT = resolve(import.meta.dirname, "../../mcp/scripts/inert.cjs");

const ENTRY_MODULE = `import { intakesOf } from "@lifeline/core";
import { APPS } from ${JSON.stringify(join(shell, "src/apps.ts").replace(/\\/g, "/"))};
export default intakesOf(APPS).map(({ key, title }) => ({ key, title }));
`;

/** The Intakes list as the file the shell serves: `{ intakes: [{ key, title }] }`. */
export async function intakeListJson(): Promise<string> {
  const out = mkdtempSync(join(tmpdir(), "lifeline-intakes-"));
  try {
    await build({
      configFile: false,
      root: shell,
      logLevel: "error",
      resolve: { alias: { "@": join(shell, "src") } },
      plugins: [
        {
          name: "lifeline-intake-list",
          enforce: "pre",
          resolveId: (id) => (id === ENTRY ? "\0" + ENTRY : BROWSER_ONLY.test(id) ? INERT : undefined),
          load: (id) => (id === "\0" + ENTRY ? ENTRY_MODULE : undefined),
        },
      ],
      ssr: { noExternal: true, target: "node" },
      build: { ssr: true, outDir: out, emptyOutDir: true, minify: false, rolldownOptions: { input: ENTRY, output: { format: "esm", entryFileNames: "intakes.mjs" } } },
    });
    const intakes = (await import(pathToFileURL(join(out, "intakes.mjs")).href)).default as IntakeEntry[];
    return JSON.stringify({ intakes }, null, 2) + "\n";
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

/** Serves the Intakes list at `/intakes.json`: written into the build, and answered by the dev server. */
export function intakesPlugin(): Plugin {
  let json: Promise<string> | undefined;
  const list = () => (json ??= intakeListJson());
  return {
    name: "lifeline-intakes",
    // Started with the build, so the registry bundles alongside the app.
    buildStart() {
      void list().catch(() => undefined);
    },
    async generateBundle() {
      this.emitFile({ type: "asset", fileName: INTAKES_PATH.slice(1), source: await list() });
    },
    configureServer(server) {
      server.middlewares.use(INTAKES_PATH, (_req, res, next) => {
        list().then((body) => {
          res.setHeader("Content-Type", "application/json");
          res.end(body);
        }, next);
      });
    },
  };
}
