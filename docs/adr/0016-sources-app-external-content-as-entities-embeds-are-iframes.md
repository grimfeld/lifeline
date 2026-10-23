---
status: accepted
superseded-by: ADR 0070 (in part — the name "Source")
---

# External content lives in a Sources App as entities; Embeds are honest iframes

Users want outside things (a Grafana panel, a doc, a video) on their Screens. Two shapes were possible for the first kind, the Embed: a Core `hub.embed` Card whose instance setting is the URL (needs a `text` settings kind; each placement is its own unnamed URL), or a small **Sources** App owning `Embed { name, url, tags, refreshMinutes }` records with a Card that picks one through the existing `entity` settings kind. We chose the App: Core keeps owning no data, an Embed is named, tagged, Linkable and reusable across Screens, and later kinds of external content (feeds, live values) join as sibling Source kinds instead of growing Core. For rendering we chose a plain `<iframe>` plus an always-present "Open ↗" (system browser via the Tauri opener) over proxying through PocketBase (breaks logins, security foot-gun) or a native Tauri child webview (unstable API, awkward in a grid, absent in browser dev). Consequence accepted: pages that send `X-Frame-Options`/`frame-ancestors` stay blank and third-party-cookie logins mostly won't work inside the frame — the escape hatch is the point.

## Consequences

- New `apps/sources` package with the `sources` collection, a Sources screen, a hidden full-page route, `sources.embed` Card (`embed` entity required, `scale` select), Linkable + Taggable, "New embed…" command.
- Only `http(s)` URLs are accepted; normalised on save.
- The Embed Card is a single-entity Card: not `tagFilterable`.
