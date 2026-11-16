---
status: accepted
amends: ADR 0097 (in part — the Permissions-Policy allows geolocation to Lifeline's own origin), ADR 0109 (in part — location is no longer denied)
---

# Here reads the device's position once, on tap, so geolocation is allowed for Lifeline's origin

ADR 0119 gives the Place form **Here**: standing somewhere, I tap it and pick the place I am in from the places around me. That needs the device's position, and ADR 0097's `Permissions-Policy` denies it outright (`geolocation=()`), which ADR 0109 left as it was.

- **Geolocation is allowed for Lifeline itself.** The policy now reads `geolocation=(self)`. Embeds and every other origin are still denied it, and the microphone, payment and USB stay denied.
- **Once, on tap.** Here calls `getCurrentPosition` when tapped, and nothing else asks: no `watchPosition`, no position read on load or in the background. Where the browser has no geolocation, Here is not shown; a refusal or no fix says so, and the name is typed instead.
- **Sent to Photon only, and never kept.** The position goes once, on tap only, to Photon's reverse lookup (`photon.komoot.io/reverse`, already in `connect-src` for the typeahead) for the points of interest around it. The data sent is the position **rounded to 4 decimals (about 11 m)**, which is finer than the 200 m search needs, plus the language; the exact fix never leaves the device. The owner signed off on this flow to an outside service during the review of PR #528, on condition of the rounding. It is not cached, stored, synced or logged, and a failed lookup reports its status alone. What is kept is the Place's coordinates: the picked place's, or, with **Just here**, the exact position as the coordinates of the Place I name.

## Considered options

- **Ask for the position when the Place form opens**: rejected. It would read where I am every time I add a Place from my desk, and prompt before I asked for anything.
- **Nominatim's reverse geocoding**: rejected. It answers with the one nearest address, not the places around it to choose from, and Photon already serves the typeahead.

## Consequences

- A Tauri build, desktop or Android, needs its webview's geolocation permission granted (and the Android manifest's location permission) before Here appears to work there; until then a refusal shows the message.
