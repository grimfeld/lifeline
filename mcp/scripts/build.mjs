// Bundles the MCP server for Node. The Apps are written for the browser shell
// (TSX, CSS imports, Vite's import.meta.env); esbuild compiles them in and the
// stylesheets drop out, so the server runs the very same App operations.
import { readFileSync } from "node:fs";
import { build } from "esbuild";

const entries = process.argv.slice(2);

/**
 * View-only libraries the Apps' screens import. The server never renders a
 * view: some of these touch `window` the moment they load, and the rest
 * (icons, UI kits) would only cost memory — lucide-react alone, as CommonJS,
 * is every icon copied into every importer. Each is swapped for scripts/inert.cjs.
 */
const BROWSER_ONLY = /^(leaflet|react-leaflet|@react-leaflet\/.*|recharts|@codemirror\/.*|@lezer\/.*|react-grid-layout|d3-force|d3-quadtree|lucide-react|radix-ui|@radix-ui\/.*|cmdk|sonner|next-themes|@dnd-kit\/.*|@fontsource-variable\/.*)(\/.*)?$/;
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
