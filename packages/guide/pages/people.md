# People

The people in your life: family, friends, colleagues, someone you met once, someone who has
died. Each one is a **Person** you can link to from anywhere, with a page of their own.

## People

What you keep here: People, each with a name, the other names they go by (aliases), what they
are to you (their **Relationship**), Tags, and a page of your own words about them.

The People home is a placeholder for now: it offers **Add person**. Reach someone from a link to
them, the palette, or the People Base.

### A Person's page

- **Header** — their name, what they are to you, and their aliases.
- **Details** — change their name (every `[[link]]` to them follows), their **Aliases**, their
  **Relationship** and their **Tags**, edited in place.
- **Reports** — **Last seen** (the last day of an Event that links to them) and **Last
  mentioned** (the last Day that links to them), side by side and never added together. Seen
  counts an Event once per day it is on, every day of a trip, and nothing in the future; Tasks
  and Occasions never count. A type can also choose **Seen count**, a **Seen heatmap**, **Top seen**
  and **Not seen lately** in its editor, and each can be placed as a Report Card.
- **About them** — the body: what you know of them, written with `[[links]]` and `#tags` like
  any page.
- **Events, Tasks and the rest** — what links to them through a People field (an Event's **With**), grouped by what it is.
- **Backlinks** — every Day, Note or other Document that links to them. Click one to peek at it.

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
  for people in your life.
- A type of your own you already made for people keeps its Documents as they are.

## Related

- [Journal](journal.md) — the Days you write about people in.
- [Links](links.md) — how `[[links]]`, aliases and backlinks work.
- [Peek and selection](peek.md) — the Peek, and the Selection menu.
