# Progress

Where you log your days and watch yourself change: numbers you track, habits you level up, your
workouts, your mood and the swear jar.

Progress opens on **Today**: today's mood, your daily marks, a workout to start and the swear jar,
on one page. Move, resize, add or remove Cards as you like. Beside it: **Stats**, **Life Level**,
**Workout**, **Mood** and **Swear Jar**.

## Stats

What you keep here: **Stats** — anything you count or measure — and their **Entries**. Each Stat
is one of four kinds, fixed when you make it:

- **Additive** — entries add up (push-ups, pages read).
- **Measurement** — a reading at a moment (weight).
- **Boolean** — a day was done or not; builds **streaks**.
- **Collection** — distinct things collected (countries visited), optionally out of a total or
  a checklist of items.

Commands and Cards:

- **Log entry** — pick a Stat, then add a value (or mark the day, or name the item collected).
  Backdating is allowed. Where: the Capture sheet, the palette (Ctrl+K), **Log** / **Mark** on a
  Stat's page.
- **New stat** — name, kind, unit, colour, and a quick-log amount. Where: the **New stat**
  button on Stats, the palette.
- **Go to Stats** — opens Stats. Where: the palette.
- **Stats** — Card: every Stat's headline, with one-tap logging.
- **Daily marks** — Card: your yes/no Stats over the last two weeks with streaks; mark today
  right there.
- **Single stat** — Card: pick one Stat and a period (last 7 days, last 30 days, this year, all
  time); shows its headline, trend and a log button.
- **Streak leaderboard** — Card: yes/no Stats ranked by current streak; all, or active streaks only.
- **Collections** — Card: every Collection's progress, sorted by completion or name.

On the Stats page, each Stat is a tile; the quick button marks today or adds the quick-log
amount. Tap a tile for its own page: the chart over a week, month, year or all time, every
Entry, what mentions it, and edit or delete.

## Life Level

What you keep here: **Habits** you want to keep up, and **Negative activities** you want to
avoid. Doing a Habit earns XP and levels; leaving it idle lets XP decay. Logging a Negative
takes XP away from a Habit — its paired rival, or a random one — and can push it into debt.

- Each Habit has a **Difficulty** (easy to master): harder earns more XP and decays more gently.
- Each Negative has a **Gravity** (minor, severe, catastrophic): worse does more damage.

Commands and Cards:

- **Complete habit** — log a Habit as done, now or earlier, with a note. Where: **Complete** on a
  Habit's tile, the Capture sheet, the palette.
- **Log negative** — own up to a Negative; shows which Habit it hit. Where: **It happened** on a
  Negative's tile, the Capture sheet, the palette, and a Card you can place.
- **New habit** — name and Difficulty. Where: the **New habit** button on Life Level, the palette.
- **New negative** — name, Gravity, and a rival Habit or random. Where: the **New negative**
  button on Life Level, the palette.
- **Go to Life Level** — opens Life Level. Where: the palette.
- **Habit tile** — Card: pick one Habit; its level, XP and decay pressure, with one-tap complete.
- **Log negative** — Card: every Negative, one tap away.

On the Life Level page, each Habit shows its level, XP and whether you've done it today. Tap a
Habit for its page: its ledger of completions and hits, where a single row can be deleted. Every
log shows a toast with **Undo** for a mis-tap. The speaker button mutes the sounds.

## Workout

What you keep here: **Workouts** — plans made of timed blocks (EMOM, AMRAP, Tabata, For Time,
Intervals) — your **Exercises** library, the **Sessions** you've run, and your **PRs**.

- **Start workout** — pick a Workout and go straight to the timer. Where: the palette, and a Card
  you can place.
- **New workout** — name, blocks and their movements, tags. A Workout can also log each Session
  to a Stat or a Habit for you. Where: the **New workout** button on Workout, the palette.
- **New exercise** — name, category, equipment, and what you measure (load, reps, time,
  distance or calories). Where: the **New exercise** button on Workout, the palette.
- **Go to Workout** — opens Workout. Where: the palette.
- **Start workout** — Card: every Workout one tap from the timer.
- **Recent sessions** — Card: your last few Sessions (you choose how many).

The Workout page has four tabs: **Workouts**, **Exercises**, **Sessions** and **PRs**. The timer
runs full screen with beeps and voice cues, and back, pause and next buttons. When it ends, a
summary lets you confirm each block's result and what you actually lifted or did; saving makes
the Session. PRs are worked out from Sessions by themselves.

## Mood

What you keep here: how each day felt, on five steps — Rough, Meh, Okay, Good, Great. One per day.

- **Set mood** — pick today's mood, or a past day's. Where: the Capture sheet, the palette. Typed on
  one line, `#` reads a mood by other words too: `!mood #awful`, `#bof`, `#génial`.
- **Go to Mood** — opens Mood. Where: the palette.
- **Today's mood** — Card: five buttons; tap one to set today, tap it again to clear.
- **Mood grid** — Card: one cell per day, this month or this year, with the average and the
  week-over-week direction. Cells can be tapped.

The Mood page shows the grid by **Month** or **Year**; page with the arrows. Tap any day's cell
to set or clear it. Future days can't be set.

## Swear Jar

What you keep here: **Offences** — things you fine yourself for, each with a price ("Snoozed the
alarm · €2") — and the **Fines** you log. The jar is this month's total; it starts at zero on the
1st, and past months stay readable.

- **Log a fine** — pick an Offence, optionally a time and a note; the Offence's price is the
  fine. Where: the **Fine** button on Swear Jar, the Capture sheet, the palette.
- **New offence** — name, price, and an optional emoji and colour. Where: the **New offence**
  button on Swear Jar, the palette.
- **Go to Swear Jar** — opens Swear Jar. Where: the palette.
- **Swear jar** — Card: this month's jar and every Offence one tap away.

On the Swear Jar page, tap an Offence to fine yourself now (with **Undo**); hold it (or
right-click) to backdate or add a note. Below: the month by Offence, then each Fine. The arrows
walk back through earlier months. An Offence with Fines is archived, not deleted.

## Capture

**+** on the phone (or Ctrl+K at the desk) offers from Progress:

- **Log entry** (Stats)
- **Complete habit** and **Log negative** (Life Level)
- **Set mood** (Mood)
- **Log a fine** (Swear Jar)

Starting a workout isn't capture — it's in the palette and on the Start workout Card.

## Ask Claude

Through the Lifeline connector, Claude can:

- "Log 30 push-ups" or "Mark meditation for yesterday" — `stats_log`.
- "I went for a run" — `lifelevel_complete`.
- "I had junk food" — `lifelevel_log_negative`; it says which Habit took the hit.
- "Today was good" — `mood_set`.
- "Fine me for snoozing the alarm" — `swearjar_fine`.
- Find or read anything here — `search_documents`, `get_document`.

Workouts, Exercises and new Stats, Habits or Offences are made in the app.

## Tips

- A yes/no Stat tracks whether you did something; a Habit tracks how much ground you've gained or
  lost. Use whichever question you want answered.
- Forgot to log yesterday? Every log here takes an earlier day.
- A mis-tap isn't a fact: use **Undo** on the toast, or delete the row.
- Decay only wears down progress to zero; only Negatives push a Habit into debt.

## Related

- [Capture](capture.md) — the **+** sheet and the palette.
- [Screens and Cards](screens.md) — placing Progress Cards elsewhere.
- [Journal](journal.md) — each day's logs show up on its Day.
- [Calendar](calendar.md) — Sessions appear on the time views.
- [Claude](connector.md) — the Lifeline connector.
