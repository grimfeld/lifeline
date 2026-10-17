---
status: accepted
amends: ADR 0058
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
- A Word, Sentence or Fact may sit in any Topic. Type ids keep their `language_` prefix rather than migrate.
- A Topic's Tally occurrence is its first Recall of the day, now reported by Knowledge rather than Languages (ADR 0059 is otherwise unchanged).
- Any App can make a type practicable by implementing Recallable, with no Knowledge or Core work.
