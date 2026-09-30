# Languages derives every schedule from Recalls

Languages is a simpler rebuild of lexica-v3 inside Lifeline: Words and Sentences the user met, kept by spaced repetition (FSRS, graded pass/fail). lexica-v3 stored each derived card's FSRS state and kept no history. Lifeline does the opposite, as its Ledger, Stats and Life Level already do. The only stored fact about practice is the **Recall**: one pass or fail on one Prompt at one moment, kept as an internal Document. A **Prompt** (a Word's forward or reverse, one blank of a Sentence) is never stored. Its schedule is derived at read by replaying its Recalls through FSRS. A Prompt's identity is its Document plus a slot: `forward`, `reverse`, or a blank known by its own normalised text. So identity follows what is tested, not where it sits.

## Considered options

- **Stored state per Prompt, as in lexica-v3.** Rejected. There is no history for the Daylog or Retention. A mis-tapped Recall cannot be undone once the next one lands. And every Prompt would become an internal Document to keep in step with its Word.
- **Recalls plus a cached state on the Prompt.** Rejected. It makes two truths that can drift.
- **Blanks identified by position.** Rejected. Inserting a blank early would shift every later blank's history onto the wrong blank.

## Consequences

- FSRS parameters are policy. Changing them re-values every Prompt at once, retroactively, just as Difficulty re-values Life Level's ledger.
- Striking out a mis-tapped Recall re-derives the schedule cleanly. Deleting a Word or Sentence takes its Recalls with it.
- Changing a blank's text makes a new Prompt that starts fresh. The old Prompt's Recalls stay but count for nothing. Editing a Word never resets its Prompts.
- There is no import from lexica-v3. Its cards carry state but no Recalls. Synthesising Recalls to reproduce that state would put invented facts in the record, and a special "carried-over" fact would add a second kind of fact forever for a one-time move. The user starts fresh.
- Volume is roughly 20–50 small Documents a day. Replay per Prompt is cheap; if it ever becomes slow, a cache must stay a cache and never become a second truth.
