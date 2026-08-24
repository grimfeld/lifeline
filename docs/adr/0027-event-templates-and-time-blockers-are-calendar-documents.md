# Event templates and Time blockers are Calendar Documents; blockers paint, they never place

Two quick-planning wants — "add this event again" and "show me the hours already taken" — could each have been solved by bending something that already exists. They are instead two new built-in Document types owned by the Calendar App, reaching the Schedule through the Timed contract.

An **Event template** (`event_template`) is the shape of an Event — title, length, usual start, notes, Tags — on no day of its own. Quick-adding one creates a real Event and then forgets the template: the Event has no link back, so editing a template never rewrites history, and deleting one never touches what it made. The Timed contract gains the pair `useTemplates()` / `createFromTemplate(templateId, date, start)`, so the Schedule offers templates and says *when*, while the owning App decides what a template is worth: an explicit slot wins, otherwise the template's own usual start, otherwise all day.

A **Time blocker** (`time_blocker`) is a weekly rule — weekdays, from, to, colour — painted behind the Schedule's hours. It creates no Documents per day: the App projects it into `TimedItem`s flagged `background`, one band per covered day (two when the band runs past midnight). Hour-scaled surfaces draw those bands behind everything and never drag them; day-granular surfaces (month grid, week planner, Today feed) drop them.

## Considered options

- **Blockers as recurring Events** — rejected: they would be completable-looking clutter on every day-granular surface, would need per-day Documents (or a recurrence engine Events do not have), and dragging one would silently retime a rule.
- **Blockers as Placements with a time (ADR 0015)** — rejected: a Placement pins *an item* to a slot; a blocker owns no item, and Placements are per occurrence and never repeat.
- **Templates as a flag on an Event ("this one is a template")** — rejected: a template has no day, so every surface, sort and query over Events would need to filter it out, and the guarded date field would have to become optional.
- **Templates in Core, as a generic "new Document preset"** — rejected: the length/all-day/usual-start rules are the Calendar App's semantics, and Core owns no Document types.
- **A separate Blocked contract** — rejected: a band is a thing at a fixed time that is not work, which is exactly Timed; one boolean on the item is cheaper than a second contract with its own registry, hook order and read side.

## Consequences

- The Timed contract carries a `background` flag and the two template hooks; both are optional, so no other App changes. Any App may now offer quick-add templates or paint bands.
- Blockers are a *rule*, not history: changing one changes every day it covers, past days included. Anything worth keeping as a record is an Event.
- Blockers never enter the hour window calculation — a sleep band would otherwise stretch every Schedule to a full 24 hours — and are clipped to the visible hours.
- Turning a blocker off keeps the definition and stops the paint; a blocker with no weekday covers every day.
- The rule is by scale, not by page: anything hour-scaled paints bands (the Schedule, the Agenda card on Today), anything day-granular drops them (month grid, week planner, Today feed). Bands also ignore the Tag filter — they are the hours around the content, not content — and they are a guide only: nothing refuses a drop over a band.
- `weekdays`, `start` and `end` are guarded: a Base may retitle, recolour or switch a blocker off, but the weekly rule and the overnight split go through the App.
- Both types get a Base, Tags and links for free (ADR 0018/0019); neither has a body, so neither shows up in the Vault tree.
