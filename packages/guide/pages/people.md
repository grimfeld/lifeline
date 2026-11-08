# People

The people in your life: family, friends, colleagues, someone you met once, someone who has
died. Each one is a **Person** you can link to from anywhere, with a page of their own.

## People

What you keep here: People, each with a name, the other names they go by (aliases), what they
are to you (their **Relationship**), Tags, and a page of your own words about them.

### The People home

The People Module lands on its home, which lists **Everyone**: every Person in the current
Workspace, by name, each with what they are to you and when you last saw them. Click one to open their page.

- **Search** matches a name or any alias, ignoring case and accents.
- **Relationship** and **Tag** narrow the list, and together they narrow it further. On a phone
  they are under **Filters**.
- With no one yet, the home offers **Add person**.

### Drifting

**Drifting** sits above Everyone and answers "who have I lost touch with?". It lists the People
who have a **Relationship** and whom you have **not seen in 90 days**, the longest unseen first,
each with how many days it has been. Switch it to **Not mentioned** to count the Days that link
to them instead of the Events. Someone who has never been seen is not listed, and neither is
anyone without a Relationship. It is only a list: Lifeline never reminds you.

**Leave out** on a row, or **Excluded from Drifting** on a Person's page (and in their Peek),
takes them out of Drifting, for someone you don't mean to see again. Untick it on their page to
bring them back.

### A Person's page

- **Header** — their name, their age (when their Birthday has a year), what they are to you, and
  their aliases.
- **Details** — change their name (every `[[link]]` to them follows), their **Aliases**, their
  **Relationship**, their **Tags** and **Excluded from Drifting**, edited in place.
- **Occasions** — the named days in their life: see below.
- **Ties** — how they stand to other People, each read from their side: "daughter: Léa" on
  Anne's page, "mother: Anne" on Léa's. See Ties below.
- **Reports** — **Last seen** (the last day of an Event that links to them) and **Last
  mentioned** (the last Day that links to them), side by side and never added together. Seen
  counts an Event once per day it is on, every day of a trip, and nothing in the future; Tasks
  and Occasions never count. A type can also choose **Seen count**, a **Seen heatmap**, **Top seen**
  and **Not seen lately** in its editor, and each can be placed as a Report Card.
- **About them** — the body: what you know of them, written with `[[links]]` and `#tags` like
  any page.
- **Events, Tasks and the rest** — what links to them through a People field (an Event's **With**), grouped by what it is.
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
### Ties

A **Tie** says how two People stand to each other. Press **Add tie** on either Person's page,
find the other Person by name, and give a word for each end ("mother" and "daughter"). It is
stored once and shows on both pages, each read from its own side, with the other Person as a
link. The words are yours: "godmother", "ex" and "best friend's brother" all fit. **Edit** or
**Remove** it from either page and both change. A Tie is never to you, only between two People.
Deleting a Person removes their Ties; the other Person's page is untouched. A Tie is not a link
in a body, so it adds no Backlink and counts for no Report.

### Linking to a Person

- Write `[[` and their name, or any of their aliases: `[[Mum]]` and `[[Anne Dupont]]` land on
  the same Person. The completer marks each one as a Person, with their Relationship.
- Click a link to a Person to open them in a **Peek**, where you can change their aliases,
  Relationship and Tags and write in their body. **Open** goes to their page.
- Select a name in a Day (or any body) and pick **Person** under **People** in the Selection
  menu: the Person is made, and the name becomes a link to them.

### Cards

- **People by Relationship** — your People grouped under each Relationship, with how many there
  are under it; each name opens their page. People with no Relationship are left out. Where: a
  Card you can place on any Screen.

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

### What Claude sees of a Person

Claude reads a Person's name, aliases, Relationship, Tags, body, and any Field you added to
Person yourself, and it can change those.

Claude never sees a Person's **Addresses** or **Contact details**, current or former, from any
tool: searching for words of an address or a phone number finds nobody, and a Person's Pins on the
map are not offered to it either. Claude can't add, change or mark former an Address or a Contact
detail: you type those in Lifeline yourself, so a hidden instruction can never swap a friend's
number for someone else's.

Two things the wall doesn't cover:

- **The body is yours.** A street or a number you write in a Person's body is read like any
  body. Lifeline doesn't look for addresses in what you write; keep them in the Person's Addresses
  and Contact details instead.
- **The Private folder** still hides a whole Person from Claude, name and all.

## Tips

- A Relationship is your own words ("my aunt", "climbing partner"), not a fixed list. Tags are
  for grouping People your own way.
- Someone in both your work and your life is two People, one in each Workspace, so each
  Workspace stays whole.
- An Author in the Library or an Artist in the Museum you have never met stays there; People is
  for people in your life. When you come to know one, choose **Turn into a Person…** on the
  Author's page (the **…** menu) or on the Artist's page in the Vault, and confirm. The same
  Document becomes a Person: its links, aliases and notes carry over, it joins People, and it
  stays an Author or Artist, so the Library and the Museum still show it and its works still
  name it.
- A type of your own you already made for people keeps its Documents as they are.

## Related

- [Journal](journal.md) — the Days you write about people in.
- [Links](links.md) — how `[[links]]`, aliases and backlinks work.
- [Peek and selection](peek.md) — the Peek, and the Selection menu.
