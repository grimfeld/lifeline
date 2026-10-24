---
status: accepted
---

# The fetch proxy's SSRF residual is accepted while sign-up stays closed

The fetch proxy (ADR 0017, `pocketbase/pb_hooks/fetch.pb.js`) refuses private hosts by the name written in the URL (`fetch_guard.js`). The codebase audit of 2026-10-22 (#256) found two ways round that check. A public URL can answer with a redirect to a private address, and `$http.send` follows it. And a public name can resolve to a private address (`127.0.0.1.nip.io`, DNS rebinding). Either way the body comes back verbatim, so it is a full-read SSRF into Fly's private network or the machine's metadata.

PocketBase's JSVM can neither resolve a name nor stop a redirect, so a real fix needs infrastructure. **We accept the residual**, for as long as these hold:

- Only a signed-in user can call the proxy, and sign-up is closed. Lifeline has one user (ADR 0002), who already owns the Fly apps the proxy could reach.
- The cheap guard fixes (#262: `.flycast`, the size cap) still land.

## Considered options

- **A sidecar or Worker proxy** that resolves the name, pins the IP, refuses private ranges and re-checks every redirect hop. Rejected for now: it is a new service to run and deploy, against a risk only the one user can trigger.
- **No route from the PocketBase machine to 6PN or the metadata service** (Fly network config). Rejected for now: the change needs care for little gain while the first condition holds.

## Consequences

- If sign-up ever opens, or a second person gets an account, this decision ends: the proxy moves to a sidecar first.
- `fetch_guard.js` keeps its comment naming both gaps.
