---
status: accepted
amended-by: ADR 0109 (in part — the camera is allowed to Lifeline's own origin, for scanning a book's barcode)
---

# The web and desktop apps run under one Content Security Policy that names every origin they fetch directly


The app held a signed-in PocketBase token in localStorage and every Document in IndexedDB, and sent no security headers: any site could frame it and click through it, and any injected script could read everything. The desktop app had no CSP either, and its http plugin could reach any host, this machine and its LAN included.

**One policy, two places.** The web app sends it as a header from `shell/vercel.json`, with `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` and a `Permissions-Policy` that denies camera, microphone and location. The desktop app sets the same directives in `tauri.conf.json`, adding Tauri's IPC to `connect-src` and leaving out `frame-ancestors`, which only a header can carry. `shell/build/headers.test.ts` fails when the two drift.

- Scripts come from the app's own origin only. Styles may be inline: React, CodeMirror and Leaflet set them.
- Images and media may come from anywhere: covers, map tiles and pasted pictures are the user's to choose.
- An Embed is any https page (`frame-src https:`), framed in a sandbox that keeps its scripts and popups but stops it navigating Lifeline away or reading the clipboard.
- **`connect-src` names every origin fetched directly from the page**: production's PocketBase and each lookup or geocoding API. Everything else goes through `fetchExternal` (ADR 0017), the PocketBase proxy or the desktop's http plugin, so a Source's URL never needs to be listed. A new direct `fetch` to a new origin must add it to both files; the test lists any origin a file that calls `fetch(` names and `connect-src` lacks.
- The desktop's http plugin keeps `http(s)://**`, since Sources may be plain-http feeds, and denies loopback, private, link-local and CGNAT addresses, IPv6 literals and private names (`.internal`, `.flycast`, `.local`, `.lan`, `.home.arpa`), as the web proxy's guard does.

`vite preview` sends the same headers (`shell/build/headers.ts`), so the Demo's e2e run loads its production build under them.

## Considered options

- **A `<meta>` CSP built into `index.html`**: rejected. It cannot carry `frame-ancestors`, and the header is one file to read.
- **`Content-Security-Policy-Report-Only` for a deploy first**: rejected. The whole e2e suite ran under the policy instead (the Demo on its production build, the rest on the dev server, allowed only what dev itself needs), and nothing would collect the reports.
- **Routing the lookup APIs through the proxy, so `connect-src` would be `'self'` and PocketBase only**: rejected for now. It would add a hop and the server's load to every search as you type, for providers whose origins are fixed and few.
