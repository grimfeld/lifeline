# One Core call fetches external content (Tauri http, else a PocketBase proxy); Sources cache locally and never own item data

Feeds, Calendar subscriptions and Live values (ADR 0016's later Source kinds) all need to read a URL. From a browser the webview's CORS rules block nearly every feed; Tauri's http plugin fetches natively but only exists on the desktop; a PocketBase JS-hook route can fetch server-side from anywhere the user is signed in but not offline. We chose one Core call, `fetchExternal(url, opts)`, that uses the Tauri plugin when running under Tauri and otherwise a small authenticated PocketBase route (`/api/lifeline/fetch`, http(s) only, size- and time-capped, no cookies forwarded). Each Source's last body is kept in a *local-only* Dexie table (`_source_cache`, never synced), so surfaces render instantly and offline and refresh on the Source's period.

Boundaries chosen on purpose: a Source never owns per-item data — a Feed keeps one "seen up to" timestamp, not read flags; a Calendar subscription's events are read-only Timed items from the Sources App in the subscription's colour and are never copied into the Calendar App's Events; a Live value has no history (logging into a Stat, if ever, goes through the Stats App). Optional request headers (API keys) live on the Source record and therefore in the user's own PocketBase — accepted for a personal app.

## Consequences

- `TimedItem.color` (optional) lets a provider override the App colour; the read side honours it.
- `ical.js` expands RRULE/EXDATE/timezones; RSS/Atom are parsed with DOMParser.
- The PocketBase route is a `pb_hooks` file; the migration set does not change for it.
