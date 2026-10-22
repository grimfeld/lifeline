---
status: accepted
---

# An App screen is a lazy component, loaded on first visit behind a delayed spinner

Every App's manifest imported its screens, and `shell/src/apps.ts` imports every manifest (ADR 0003), so the first load shipped all 27 Apps' screens in one entry chunk: 2.7 MB raw, 757 KB gzip, plus ~300 KB of preloaded chunks. On Slow 4G with a 4× slower CPU nothing painted until the last of it arrived (LCP 6.29 s, #255). Any change to any App re-hashed that chunk, so every deploy made returning users download it again.

**An App screen is a `React.lazy` component.** The manifest declares it as `component: lazy(() => import("./screens/RegisterScreen").then((m) => ({ default: m.RegisterScreen })))`. `AppScreenDef.component` stays a `React.ComponentType`, so the contract keeps its type and the shell reads it as before. The rest of the manifest stays eager: types, Commands, Cards, Contract providers and Document panels. The dashboard draws Cards on first paint and the palette lists Commands, so they are needed at once. A module page an App hands to a hand-written Module (`ProjectsHome`) is lazy in the same way.

**The shell holds a screen's place while it loads.** Each App screen route, each hand-written Module page and each Core page renders inside `<Suspense fallback={<ScreenLoading />}>`. `ScreenLoading` (`@lifeline/ui`) is blank for 300 ms, then shows a centred spinner. A cached chunk never flashes it, and a slow network gets an answer. It fills only the content area, so the Rail and the Module's sidebar stay painted. On a phone the area keeps its place under the header (ADR 0064).

**Every lazy chunk is fetched ahead once the first page is idle.** Lazy components are made with `lazyChunk` (`@lifeline/ui`), which is `React.lazy` and also registers the loader. After first paint the shell runs every registered loader, one after another, and then marks `<html data-chunks="loaded">`. Lifeline has no service worker, so without this a chunk never fetched could not load once the network was gone, and a loaded app has to keep working offline. The first load gets lighter, and the total download stays the same.

Code a Card or Command shares with a screen lives outside `screens/` (`components/`, `domain/`). A Card that imports from a screen file pulls the whole screen back into the entry chunk.

The same rule covers heavy view libraries that eager code reaches: recharts (Stats and Prices charts), react-markdown (`MarkdownView`, `PlainMarkdownView`), d3-force (`GraphView`) and ical.js (calendar Sources). Each loads behind a wrapper that keeps its name and props, as `MapView` already did for Leaflet. The Guide's index (`@lifeline/guide`) is apart from its pages' Markdown (`@lifeline/guide/pages`), which only the lazy Guide page and the MCP server import.

The Node builds that load the Apps (the MCP server, the Intakes list) are unchanged. esbuild without code splitting inlines every `import()`, and their view libraries were already swapped for the inert stand-in.

## Considered options

- **A loader field (`load: () => import(...)`) that the shell wraps**: rejected for now. It would type the contract more strictly and let the shell preload a screen on hover or palette focus, but every manifest and every reader of `component` would change. If preloading is wanted later, it can be added beside `component`.
- **Lazy Cards too**: deferred. The dashboard draws its Cards on first paint, so making them lazy trades bytes for a second round trip before anything shows. Measure that separately.
- **A blank fallback, or a skeleton per screen**: a blank area leaves a slow network with no sign of life. A skeleton per screen is work for each of 40-odd screens, and it would drift from the screen it imitates.
