---
status: accepted
amends: ADR 0058, ADR 0050 (in part — the Handoff gains an origin Document), ADR 0059 (in part — a Topic's Tally is reported by Knowledge)
amended-by: ADR 0086 (in part — selecting text offers every Intake)
---

# Recallable is a Core Contract; Knowledge owns practice, in Topics

Languages kept Words and Sentences from being forgotten (ADR 0058). The same retention is wanted for history, science, philosophy and anything else, together with the synthesis the Notes Module already does. Acquisition (curricula, paths, suggested material) stays out: Lifeline never decides what is learnt.

- **Recallable** becomes a Core Contract. A type declares which Prompts its Documents yield, what each Prompt is known by, and how its question and answer are shown. It never schedules, grades or stores anything about practice.
- A new **Knowledge** App is the one consumer. It owns the Recall (ADR 0058's only fact about practice, unchanged in kind), every Practice, the schedule policy and Retention. This is the Loggable pattern: the App that receives owns the facts, and Core owns no Document types.
- The partition moves with practice. Knowledge cannot know implementers by name, so a Language (a Languages type) cannot be what it partitions by. The Knowledge App's **Topic** replaces it, with the daily new cap, the Tallies, archiving and its own Retention. Every Recallable Document belongs to one Topic.
- Practice runs either over **everything** (each Topic's cap still holding) or narrowed to one Topic, and then to one Deck.
- Languages is retired. Knowledge owns Word and Sentence, which are no longer bound to a language, and one new type, **Fact**: a question and its answer, forward only. A blanked passage is a Sentence; a two-way pair is a Word.

## Considered options

- **Generalise Languages in place, one App, no Contract.** Rejected. It is simplest now, but every future quizzable type (an Author, a Museum piece, a user-defined type) would have to move into that one App.
- **A sibling App with the engine in a shared package.** Rejected. Two Recall types and two queues make the user triage between Apps, which spaced repetition exists to avoid.
- **Core keeps Recalls as bookkeeping.** Rejected. Recalls would stop being Documents, dropping out of the Daylog and Bases and weakening striking out a mis-tapped Recall.
- **Keep Language beside a new partition, or narrow by Tags.** Rejected. Two partitions make material pick a world (*eudaimonia*: Greek or Philosophy?). Tags carry no cap, Tally or archive.

## Consequences

- Every Language becomes a Topic of the same name, keeping its cap, Tallies and archived state. Existing Recalls move to the Knowledge App unchanged, so no schedule shifts.
- A Word, Sentence or Fact may sit in any Topic.
- Nothing stored is renamed, so the move needs no migration and no schedule can shift: a Topic is still the `language` type, every Word, Sentence, Deck and Recall keeps its `languageId`, and the other type ids keep their `language_` prefix. The App and Module keep the id `languages` (as the Projects Module keeps `tasks`), and with it the `/app/languages` URL, the Due Card's id and each device's remembered active Topic. Only what is shown changes.
- A Topic's Tally occurrence is its first Recall of the day, now reported by Knowledge rather than Languages (ADR 0059 is otherwise unchanged).
- Any App can make a type practicable by implementing Recallable, with no Knowledge or Core work. The Notes App is the first outside implementer: a **kept** Quote yields one Prompt (Source and locator → passage), its Topic set at the first keep and never moved. Because Recalls belong to Knowledge and a Quote to the Notes App, deletion cascades through Core: when any Recallable Document is deleted, Core calls each App's `forgetRecallable` (Knowledge strikes the Recalls), and a Topic refuses deletion while anything Recallable is kept in it, whatever App owns it.
- The MCP tools `languages_word` and `languages_sentence` become `knowledge_word` and `knowledge_sentence`, with no aliases. Saved prompts or Routines naming the old tools must be updated, and a capture-sheet pin on the old Commands drops off until re-pinned.
- The Handoff (ADR 0050) gains an optional origin Document, and selecting text in any body offers every Intake. A Word, Sentence or Fact keeps its origin as a link; the Source it is narrowed by is read through that link, never stored, so narrowing by Source follows a Note to a new Source. A body names its Document by a `data-origin` attribute on its container, which the Document editor sets for every body it shows. A Mail Message is drawn in a sandboxed frame the page cannot read a selection from, so it is still handed off whole.
- The Due Card shows everything due, broken down by Topic, and opens the *everything* Practice.
- Delivery: (1) re-home Languages as Knowledge with Topics and no change in behaviour, checked by every Prompt's next due date being identical before and after; (2) Fact, selection-to-Intake and the origin Document on the Handoff; (3) Practice over everything and narrowed by Source; (4) other implementers when needed.

## Amendment (2026-10-22): Mail is gone

Mail is retired (ADR 0080): there is no Mail Message to hand off, and a Handoff can now come from outside Lifeline.
