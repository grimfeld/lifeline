// Bundles the MCP server for Node. The Apps are written for the browser shell
// (TSX, CSS imports, Vite's import.meta.env); esbuild compiles them in and the
// stylesheets drop out, so the server runs the very same App operations.
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { BROWSER_ONLY } from "./browser-only.mjs";

const entries = process.argv.slice(2);

// The view-only libraries (browser-only.mjs) are swapped for scripts/inert.cjs —
// lucide-react alone, as CommonJS, would be every icon copied into every importer.
const INERT = readFileSync(new URL("./inert.cjs", import.meta.url), "utf8");

const inert = {
  name: "inert-browser-libs",
  setup(b) {
    b.onResolve({ filter: BROWSER_ONLY }, (args) => ({ path: args.path, namespace: "inert" }));
    b.onLoad({ filter: /.*/, namespace: "inert" }, () => ({ loader: "js", contents: INERT }));
  },
};

await build({
  entryPoints: entries.length ? entries : ["src/server.ts", "src/worker.ts"],
  outdir: "dist",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  // ESM builds first, so unused exports shake out.
  mainFields: ["module", "main"],
  format: "esm",
  target: "node22",
  sourcemap: true,
  jsx: "automatic",
  loader: { ".css": "empty", ".svg": "empty", ".png": "empty" },
  define: { "import.meta.env": "{}" },
  plugins: [inert],
  // CJS dependencies bundled into ESM still call require(); give them one.
  banner: { js: "import { createRequire as __lifelineRequire } from 'node:module'; const require = __lifelineRequire(import.meta.url);" },
  logLevel: "warning",
});
