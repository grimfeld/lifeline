// View-only libraries the Apps' screens import, for the two builds that load
// the Apps in Node and never render a view: this server's (build.mjs) and the
// shell's published Intakes list (shell/build/intakes.ts). Some of these touch
// `window` the moment they load; the rest (icons, UI kits) would only cost
// memory. Both builds swap them for the same inert stand-in, inert.cjs: being
// CommonJS, it hands out any named import, to esbuild and Rolldown alike.
export const BROWSER_ONLY = /^(leaflet|react-leaflet|@react-leaflet\/.*|recharts|@codemirror\/.*|@lezer\/.*|react-grid-layout|d3-force|d3-quadtree|lucide-react|radix-ui|@radix-ui\/.*|cmdk|sonner|next-themes|@dnd-kit\/.*|@fontsource-variable\/.*)(\/.*)?$/;
