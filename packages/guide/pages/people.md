# People

The people in your life: family, friends, colleagues, someone you met once, someone who has
died. Each one is a **Person** you can link to from anywhere, with a page of their own.

## People

What you keep here: People, each with a name, the other names they go by (aliases), what they
are to you (their **Relationship**), Tags, and a page of your own words about them.

The People home is a placeholder for now: it offers **Add person**. Reach someone from a link to
them, the palette, or the People Base.

### A Person's page

- **Header** — their name, their age (when their Birthday has a year), what they are to you, and
  their aliases.
- **Details** — change their name (every `[[link]]` to them follows), their **Aliases**, their
  **Relationship** and their **Tags**, edited in place.
- **Occasions** — the named days in their life: see below.
- **About them** — the body: what you know of them, written with `[[links]]` and `#tags` like
  any page.
- **Backlinks** — every Day, Note or other Document that links to them. Click one to peek at it.

### Occasions

An **Occasion** is a named day in someone's life: a label (**Birthday**, **Met**, **Wedding**, or any
word you choose), a day, and whether it comes back **every year** or happens **once**. Add, edit
and remove them in **Occasions** on the Person's page. Give the day as `YYYY-MM-DD`, or `MM-DD`
when you don't know the year (a once Occasion always needs its year).

- Every Occasion stands on the Calendar's Month, Schedule and Upcoming views and on Today as an
  all-day flag, taking no hours: "🎂 Anne · 65", "⚑ Marc · Surgery". A yearly one comes back every
  year; a once one stands only on its day. It is not an Event, so it can't be dragged and doesn't
  count as seeing someone. It is not a Deadline either: it is never drawn red once its day has
  passed. Click it to open the Person.
- **Birthday** is the one label Lifeline understands. With the birth year known, the marker carries
  the age they reach ("🎂 Anne · 65") and their page shows how old they are now. With no year
  there is no age: Lifeline never makes up a number.
- A yearly Occasion on **29 February** stands on 29 February in a leap year and on **28 February**
  in the other years, so it is never skipped.
- An Occasion two people share, such as a wedding, is added to each of them.

### Linking to a Person

- Write `[[` and their name, or any of their aliases: `[[Mum]]` and `[[Anne Dupont]]` land on
  the same Person. The completer marks each one as a Person, with their Relationship.
- Click a link to a Person to open them in a **Peek**, where you can change their aliases,
  Relationship and Tags and write in their body. **Open** goes to their page.
- Select a name in a Day (or any body) and pick **Person** under **People** in the Selection
  menu: the Person is made, and the name becomes a link to them.

### Commands

- **Add person…** — a new Person, from their name alone. Where: the Capture sheet, the palette
  (Ctrl+K).
- **Go to People** — the People home. Where: the palette.

## Capture

**+** on the phone (or Ctrl+K at the desk) offers **Add person…** under People: just a name, so
you can add someone you just met before you forget it.

## Ask Claude

- "Add my aunt Anne Dupont, I call her Mum" — `people_add`, with a name, aliases and a
  Relationship.
- "Whose birthday is coming up?" — `agenda` lists Occasions as `occasion` entries, apart from
  Deadlines.
- "What have I written about Anne?" — `search_documents`, `get_document`.

## Tips

- A Relationship is your own words ("my aunt", "climbing partner"), not a fixed list. Tags are
  for grouping People your own way.
- Someone in both your work and your life is two People, one in each Workspace, so each
  Workspace stays whole.
- An Author in the Library or an Artist in the Museum you have never met stays there; People is
  for people in your life.
- A type of your own you already made for people keeps its Documents as they are.

## Related

- [Journal](journal.md) — the Days you write about people in.
- [Links](links.md) — how `[[links]]`, aliases and backlinks work.
- [Peek and selection](peek.md) — the Peek, and the Selection menu.
