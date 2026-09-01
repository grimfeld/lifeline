# Mood is its own App: one Mood per day, migrated out of the daily note

Mood lived in the Notes App as a `select` field on the `daily` type — five values (😞 Rough … 😄 Great) picked while writing the daily note, drawn by one Card as a bar strip over the last N days. It worked, but mood was a passenger: it existed only where a daily note existed, it had no place of its own to be looked at, and the picture that makes mood tracking worth doing — a whole year of colour, read at a glance — had nowhere to live.

Mood becomes its own **App**, owning one Document type, the **Mood**: how a single day felt, on a fixed five-point scale, at most one per day. Its title is the date, so Core's per-type title uniqueness gives "one per day" for free, exactly as it does for daily notes. The scale — labels, emoji and the five colours — is **fixed in code**, not configurable: the grid's whole claim is that a colour means the same thing in 2024 and in 2027, and a settings screen that lets you recolour history quietly breaks it. A day with nothing recorded is an **absence**, drawn as an empty cell, never a sixth mood; future days are inert, because a day you haven't lived can't have felt like anything.

The App's screen is one grid — one cell per day, coloured by that day's Mood — toggling between a single month (weekday-aligned) and a whole year (twelve month-columns). The grid is also the capture surface: clicking any past or present cell opens the five moods and sets or clears that day. Two Cards go with it: *Today's mood* (five buttons, for the Dashboard and the phone home) and *Mood grid* (the same picture in miniature, with the window's average and its week-over-week direction in the header — the one useful number the old strip card carried).

A **migration moves the existing moods**: every daily note carrying a `mood` becomes a Mood Document dated by that note's title, the `mood` field leaves the `daily` type definition, and the stale values stay harmlessly on the old rows. The old `notes.mood` Card is deleted; a stored instance of it shows "unavailable" and is replaced by hand, the way ADR 0024 handled the media split. The daily note keeps *showing* the day's mood — the Mood App reports it through the **Daylog**, and the Today journal card reads the Document — but it no longer owns or sets it: capture is the Mood App's, in one place.

Mood is deliberately **not Linkable**. Its title is a date, and daily notes are already titled by date; making both wikilink targets would make `[[2026-09-01]]` ambiguous for a link nobody wants to write — prose points at the day, not at the feeling.

## Considered options

- **A grid Card inside the Notes App, keeping the field** — the cheapest option by far, and rejected: it leaves mood as a property of a note, so a day without a daily note can't have a mood, and mood never gets a screen. The grid deserves a destination.
- **A Mood App that reads the daily note's field (a lens, like Bible over the study)** — rejected: the Bible App owns its own types and only *reads* others' Documents; this would have an App writing a field another App owns, which is precisely the coupling ADR 0019 exists to prevent, and a Base editing `daily.mood` raw would be a second, unguarded writer.
- **A measurement Stat in the Stats App** — rejected: a Stat is neutral series tracking with a numeric value, and CONTEXT.md is explicit that a Stat is not the thing that carries meaning per step. Five named, coloured, ordered moods are a category, not a measurement, and the "duplicates collapse at derivation" model fights "exactly one per day".
- **Several moods per day, the cell showing a roll-up** — rejected: honest about how days actually go, but it forces a roll-up rule (average? latest? worst?) onto a picture whose whole point is directness, and the average of Rough and Great is "Okay", a colour no moment of that day ever was.
- **User-defined moods, or editable labels and colours** — rejected: it breaks the fixed five-colour premise, and recolouring silently restyles years of history. A knob turned once is not worth a second Document type.
- **Keeping the field as the capture UI, writing through to the Mood Document** — rejected despite the better ergonomics while journalling: two writers on one fact, one of them foreign and one of them a raw Base edit away from desync.
- **Leaving old moods behind and starting fresh** — rejected: the history is the reason the grid is interesting, and two mood concepts in the glossary is exactly the confusion this decision exists to remove.

## Consequences

- The `daily` type loses its only field; daily notes are body-only again, and stray `mood` values remain on already-written rows without meaning anything.
- Stored `notes.mood` Card instances break visibly (the ADR 0024 pattern) rather than being silently remapped.
- Mood is capturable on a day with no daily note at all — a gap that could not exist before.
- The migration is server-side, like every migration here, so it moves what the backend holds: daily notes that only ever existed on one device, never synced, keep their stale `mood` value and get no Mood Document.
- Reversing this means another migration back into the note's fields (the down step does exactly that, dropping Moods on days with no note); the Documents, not the field, are now the record.
- The Mood screen shelves under the **Progress** nav group, beside Stats, Life Level and Workout.
- Nothing implements Loggable yet: no other App can stamp a mood. Adding it later is additive and nothing in the model blocks it.
