---
status: accepted
---

# A body's image from another site loads only when asked

Reading mode rendered `![](https://…)` as soon as a Document opened (#270). Clipped and handed-off content (ADR 0080) can carry a tracking pixel, which then learns the user's address and when they read it.

**An image from another site waits for a click.** In its place, reading mode shows its host with **Load**, which shows it once, and **Always from <host>**, which trusts that host on this device (kept in `localStorage`, per device like the date language of ADR 0093). Attachments, `data:` URLs and Lifeline's own address load as before.

## Considered options

- **Keep auto-loading.** Rejected: the body is the user's, but a clipped page's images are not.
- **A CSP `img-src` allow-list.** Rejected: anything not listed breaks without a word, and the list would need a setting to grow.

## Consequences

- Media covers, Author photos and artwork images are fields the user picked through a lookup, not body content, and still load.
- The trusted hosts do not sync: trusting a host on the laptop says nothing about the phone.
