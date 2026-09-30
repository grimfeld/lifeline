# Tallying is a Core Contract, the sending side of Loggable

ADR 0031 made the receiving side of cross-App logging a Core Contract (**Loggable**: Stats and Life Level list targets and do the writing). It left the sending side inside Workout: a `tallies` field on the Workout, Workout's own editor, and Workout's own firing on Session save. It also expected Chores or Tasks to grow "a Tally-like field on their side". Languages is the second sender: a Language "tallies to Habit *Spanish*" once per day practised. Rather than copying Workout's pattern, the sending side becomes Core's **Tallying** Contract.

- The owning App declares what an **occurrence** of its Documents is and which values it offers. Workout offers a saved Session with *one* or *duration*. Languages offers a Language's first Recall of the day with *one*.
- The App reports each occurrence with a moment, its values and an **occurrence key**.
- Core keeps the Tallies in a Core-reserved `tallies` field on the Document itself, so they follow the Document (its Workspace, its deletion) with no collection of their own. Core also offers the one "tallies to…" editor over every Loggable target, fires through `logTo`, and logs each occurrence key once.

This supersedes the per-App Tally described in ADR 0031. Loggable is unchanged.

## Considered options

- **Copy Workout's pattern into Languages, and extract when a third sender appears.** Rejected. Each copy would re-solve the same editor, firing and dedupe. The dedupe is harder for Languages than for Workout, because "first Recall of the day" is decided on each device.

## Consequences

- Workout's `tallies` field already had the shape Core keeps, so it stays where it is and becomes Core's. The Session's own `tallied` mark is retired: Core writes a **fire mark** per Tally and occurrence key, after the log succeeds, and Workout reports each saved Session as an occurrence. The occurrence key for a Session is its id. For a Language day it is the date.
- Fire marks live on the device only (a local table, never synced). They stop a re-report on the same device, such as a Recall struck out and made again the same day. Across devices it is the owning App's own reading of "has this occurred yet" that stops a second report.
- A Tally never retracts. What it logged is the receiver's Document, with the receiver's own undo. Striking out the Recall that fired it, or deleting the Session, does not un-log.
- A Tally is never backfilled. Setting one up today logs nothing for past occurrences.
- An archived Language's Tallies stay silent.
- Known gap: two devices practising offline on the same day can each fire before they sync, and so can a second device after the first one's only Recall of the day was struck out. At worst there is one extra Completion or Entry, removed in the receiving App.
- Chores and Tasks can become senders by declaring their occurrences, without new Core work.
