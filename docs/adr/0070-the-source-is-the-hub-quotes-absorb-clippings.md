---
status: accepted
supersedes: ADR 0024 (in part — the Commonplace book's Quote limited to works), ADR 0016 (in part — the name "Source"), ADR 0019 (in part — the Clipping type)
---

# The Source is the hub; Quotes absorb Clippings

Two near-identical acts had two homes. A **Clipping** (Clipper App) was pasted text whose `source` was free text — a URL or a name, linked to nothing. A **Quote** (Quotes App) was a passage that had to link to a work, but only to one of six Library and Culture types, so an article or a podcast could not be quoted. Nothing gathered what came from one place, and nothing was a place to start from.

The **Source** becomes the hub: a **Role** (ADR 0069) worn by anything I take Notes and Quotes from — books, films and albums keep their own type and family App and simply wear it; articles, podcasts, episodes, videos and websites are the Notes App's own Source type. A Source may belong to a **parent Source** (a show and its episodes, a magazine and its articles); a page or a minute is a **locator**, never a Source. The Notes Module shelves Sources by kind and Tags, and a Source's page is where its Notes and Quotes gather and where new ones start.

One **Notes** App owns the Source type, the **Note** (my words on a Source) and the **Quote** (a passage from a Source: text short or long, optional locator and comment). Both are impossible without their Source. The Clipper and Quotes Apps retire into it; "Clipping" retires as a term. Phone capture offers the Sources I'm in now — the Nightstand's current works and recent Sources — and a new Source by title alone, so a required Source costs one tap; with no Source at all, the thing is a Thought.

The old Sources App — Embeds, Feeds, Calendar subscriptions, Live values — is renamed **Windows**, freeing the word for the hub, and lives in the Notes Module: a Feed's item becomes a Source in one tap.

## Considered options

- **Keep Clipping and Quote apart** — rejected: once every Clipping needs a Source, the two differ only in length.
- **Call the hub "Origin"** — rejected: "Source" is the word used every day; the Windows rename costs less than a lifetime of saying the wrong word.
- **A sourceless Note sitting in an inbox until filed** — rejected: an inbox to empty is a chore; an unsourced thought is a Thought.

## Consequences

- Mail's "keep" Intake and Languages' origins now produce or point at Quotes; the Intake asks for the Source in its dialog.
- Quotes Cards (random, of-the-day, quotes of a work) carry over, now over any Source.
- Migration: each Clipping becomes a Quote; Sources are created from the distinct old `source` strings; Quotes keep their work as Source.
- A Thought converts into a Note by attaching a Source, and back by detaching it, keeping the Document so links survive.

## Amendment (2026-10-22): Mail and Languages are gone

Mail is retired (ADR 0080), and its "keep" Intake with it; Languages is now Knowledge (ADR 0073), whose Words, Sentences and Facts keep their origin as a link.
