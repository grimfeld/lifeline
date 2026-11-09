# People

The people in your life: family, friends, colleagues, someone you met once, someone who has
died. Each one is a **Person** you can link to from anywhere, with a page of their own.

## People

What you keep here: People, each with a name, the other names they go by (aliases), what they
are to you (their **Relationship**), Tags, and a page of your own words about them.

### The People home

The People Module lands on its home, which opens on **Upcoming** and then lists **Everyone**: every Person in the current
Workspace, by name, each with what they are to you and when you last saw them. Click one to open their page.

- **Upcoming** — the Occasions in the next 30 days, soonest first: who, which Occasion, the day and
  how far off, and for a Birthday with a known year the age they will turn. Each row opens the Person.
  It is a heads-up, never a reminder. It can also be placed as an **Upcoming** Card on any Screen, with
  its own number of days ahead.
- **Search** matches a name or any alias, ignoring case and accents.
- **Relationship** and **Tag** narrow the list, and together they narrow it further. On a phone
  they are under **Filters**.
- With no one yet, the home offers **Add person**.

### Drifting

**Drifting** sits above Everyone and answers "who have I lost touch with?". It lists the People
who have a **Relationship** and whom you have **not seen in 90 days** (a fixed window, with no setting): first anyone you have
never seen ("Never seen"), then the longest unseen, each with how many days it has been. Switch
it to **Not mentioned** to count the Days that link to them instead of the Events. Anyone
without a Relationship is not listed. It is only a list: Lifeline never reminds you.

**Leave out** on a row, or **Excluded from Drifting** on a Person's page (and in their Peek),
takes them out of Drifting, for someone you don't mean to see again. Untick it on their page to
bring them back.

### A Person's page

- **Header** — their name, their age (when their Birthday has a year), what they are to you, and
  their aliases.
- **Details** — change their name (every `[[link]]` to them follows), their **Aliases**, their
  **Relationship**, their **Tags** and **Excluded from Drifting**, edited in place.
- **Contact details** — the ways to reach them, each under a label of your own ("Mobile", "Work",
  "Instagram"). See below.
- **Occasions** — the named days in their life: see below.
- **Addresses** — where they live or can be found, each under a label of your own ("Home",
  "Work", "Holiday house"). See below.
- **Ties** — how they stand to other People, each read from their side: "daughter: Léa" on
  Anne's page, "mother: Anne" on Léa's. See Ties below.
- **Reports** — **Last seen** (the last day of an Event that links to them, through its **With**
  or a `[[link]]` in its notes) and **Last
  mentioned** (the last Day that links to them), side by side and never added together. Seen
  counts an Event once per day it is on, every day of a trip, and nothing in the future; Tasks
  and Occasions never count. A type can also choose **Seen count**, a **Seen heatmap**, **Top seen**
  and **Not seen lately** in its editor, and each can be placed as a Report Card.
- **About them** — the body: what you know of them, written with `[[links]]` and `#tags` like
  any page.
- **Events, Tasks and the rest** — what links to them through a People field (an Event's **With**, a Task's or a Transaction's **For**, a book's **Recommended by**), grouped by what it is. Only an Event counts as having seen them: its **With**, or a `[[link]]` to
  them in its notes ("Dinner with [[Marc]]").
- **Backlinks** — every Day, Note or other Document that links to them. Click one to peek at it.

Deleting a Person takes them out of every People field that held them (an Event's **With**, a
Task's **For**…); the Events, Tasks and the rest stay. A `[[link]]` to them in a body becomes an
unresolved link, as for any deleted page.

### Contact details

Add one with **Add contact detail** on the Person's page: a **label**, a **kind** (Phone, Email or
Handle) and the number, address or handle as you'd type it. Pencil edits it, the cross-person
button marks it former, the bin removes it (with Undo).

- **Phone** — a click calls (`tel:`); on a computer, whatever handles calls there answers.
- **Email** — a click opens a new mail to them.
- **Handle** — a click opens the service in a new tab, when Lifeline can tell which: a web
  address you typed (`instagram.com/anne`), a Fediverse address (`@anne@mastodon.social`), or a
  `@name` whose label names the service (Instagram, X or Twitter, GitHub, Telegram, TikTok,
  LinkedIn). Any other handle stays plain text.
- **Former** — a number that stopped working, an account they closed. It moves under **Former**,
  struck through, with no action, as history; the same button makes it current again.

Contact details are never on the map, and Claude never sees them (below).
### Occasions

An **Occasion** is a named day in someone's life: a label (**Birthday**, **Met**, **Wedding**, or any
word you choose), a day, and whether it comes back **every year** or happens **once**. Add, edit
and remove them in **Occasions** on the Person's page. Pick the day in the date picker; for a
yearly one whose year you don't know, tick **I don't know the year** and choose a month and a
day instead (29 February included). A once Occasion always needs its year.

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

### Addresses

- **Add address** takes a label and the postal text. The bin removes one, with Undo. When you save it, Lifeline looks the place
  up (OpenStreetMap's Nominatim) and puts a **Pin** on the Map, labelled "Marc · Work". A
  Person with two current Addresses stands on the Map twice.
- When someone moves, **Mark as former**: the Address leaves the Map and stays on their page, below
  the current ones, as history. **Mark as current** brings it back.
- If the lookup finds nothing, or fails, the Address is still saved and shown, marked "Not on
  the map", with **Try again**. The message says which: no place found means check the text; the
  lookup could not be reached means try again later. Changing an Address's text looks it up afresh.
- A shared home is held by each Person who lives there: add it to each.
- Claude never sees a Person's Addresses or their Pins (see below).

### Ties

A **Tie** says how two People stand to each other. Press **Add tie** on either Person's page,
find the other Person by name, and give a word for each end ("mother" and "daughter"). It is
stored once and shows on both pages, each read from its own side, with the other Person as a
link. The words are yours: "godmother", "ex" and "best friend's brother" all fit. **Edit** or
**Remove** it from either page (with Undo) and both change. A Tie is never to you, only between two People.
Deleting a Person removes their Ties; the other Person's page is untouched. A Tie is not a link
in a body, so it adds no Backlink and counts for no Report.

Removing anything from a Person's page (an Occasion, an Address, a Contact detail or a Tie)
happens at once, with **Undo** on the message that follows: it puts back just that one, even
if you have added something since.

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
- **Add occasion…** — a birthday, anniversary or other Occasion for a Person found by name or
  alias; it has no screen, and is how Claude adds Occasions (`people_occasion_add`). Where: Claude
  only.
- **Go to People** — the People home. Where: the palette.

## Capture

**+** on the phone (or Ctrl+K at the desk) offers **Add person…** under People: just a name, so
you can add someone you just met before you forget it.

## Ask Claude

- "Add my aunt Anne Dupont, I call her Mum" — `people_add`, with a name, aliases, a
  Relationship and Tags.
- "Anne's birthday is 12 November 1961" — `people_occasion_add`, for the Person found by name or
  alias, with a label, a day (the year optional) and yearly or once. An unknown name, or one
  that two People share, is refused and Claude asks which.
- "Whose birthday is coming up?" — `people_upcoming` is the Upcoming Report for the next days,
  with the age each Birthday reaches; `agenda` lists Occasions too, as `occasion` entries apart
  from Deadlines, with the same age.
- "When did I last see Anne?" — `get_document` on a Person adds their Last seen and Last
  mentioned, from what Claude is allowed to read.
- "Who is Léa to Anne?" — `get_document` on a Person also lists their Ties, read from their side
  ("daughter: Léa"), leaving out anyone in the Private folder.
- "What have I written about Anne?" — `search_documents`, `get_document`.

### What Claude sees of a Person

Claude reads a Person's name, aliases, Relationship, Tags, Occasions, Ties, body, and any Field you
added to Person yourself, and it can change those; it can add an Occasion.

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
