# Time blockers come in a weekly and a one-off shape; only the one-off is dragged

Travel to the dentist, prep before a call: hours that are *taken* but on one day only, and that the user wants to drop onto the Schedule and drag around — not a weekly rule (ADR 0027), not an Event (content on every surface, filtered by Tags, shown in the month grid). We extend `time_blocker` with a second shape: a **one-off** carries a `date` instead of `weekdays`; it paints one band on that day and, unlike a weekly band, may be moved and resized on the Schedule through the Timed `reschedule` hook. A **Blocker template** (`blocker_template`: title, length, colour) sits in the Schedule palette beside the Event templates and, dropped on an hour, creates a one-off blocker there and forgets itself — the same `useTemplates()` / `createFromTemplate()` pair Event templates use, with the template flagged `background` so the surface knows what it will make.

## Considered options

- **Travel as an Event template** — rejected: already possible, but an Event is content — it lands in the month grid, the Today feed, Tag filters — while travel is the hours around the content.
- **A third Document type for one-off bands** — rejected: same paint, same rules (behind everything, ignored by day-granular views and Tag filters), one field apart; two Bases for one idea.
- **Attaching a one-off blocker to an Event** ("30 min before") — deferred: nothing else in the model links two Timed things; the band stays put when the Event moves and is dragged by hand. Revisit if it gets tiresome.
- **Letting weekly bands be dragged too** — rejected (ADR 0027): a drag would silently retime a rule for every week.

## Consequences

- `TimedItem.background` items now split: the provider marks a band `fixed` when it comes from a rule; the Schedule drags only unfixed bands, and `reschedule` on a one-off retimes that Document alone.
- `TimedTemplate` gains `background`; the palette shows blocker templates with the band hatch so the user sees what they will get.
- One-off blockers are kept once past (a record like everything else), so the `time_blocker` Base fills with "Travel" rows — the Base can filter by date; nothing is auto-deleted.
- `weekdays` and `date` are exclusive: a blocker with a `date` ignores `weekdays`; the "Templates & blockers" screen edits weekly ones and lists one-offs read-only by day.
