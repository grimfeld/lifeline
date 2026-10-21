---
status: accepted
---

# The preferred date language is kept per device



The palette's `/` reads dates in English and French at once (ADR 0091); a preferred language settles the few words the two read differently (`mar`: March, mardi). Lifeline has no record of account-wide preferences to put that choice in, and making one (a synced collection, a migration, the owner hooks) for a single two-way switch costs more than the switch is worth.

**The preferred date language is kept per device**, in `localStorage`, like the Workspace a device is in (`lifeline.dates.language`, default English). It goes with the keyboard and the person typing at it, and choosing it again on another device takes one click in Settings → Dates in the palette. Every language stays understood whatever the choice, so a device that has not chosen still reads `/demain`.

Each language is a table of words (`DATE_VOCABULARIES` in `packages/core/src/inlineDates.ts`) read by one set of rules: adding a language adds a table, and the setting lists it by itself.

## Considered options

- **A synced user-preferences record**: deferred until a second account-wide preference needs one; this setting would then move into it.
- **The browser's language as the preference**: rejected. It is often English on a French speaker's machine, and a reading that changes with the browser is not predictable.
