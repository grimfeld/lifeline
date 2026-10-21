# Capture

Capture is getting something into Lifeline in seconds, without going anywhere: a Task, a spend, a
film watched, a thought. On a phone it is the **Capture sheet**; at the desk it is the command
palette.

## The Capture sheet (phone)

- Tap **Capture** (**+**), the middle of the Phone bar. It is there on every page.
- It lists every capture Command of this Workspace's Modules, grouped under their Module.
- **Calendar** comes first: **Add event**, and **Add today…** with your Event templates inside it.
- Tap one to open its form. Nothing is saved until you save the form.
- No search on the sheet — typing is the palette's job.
- Nothing on it moves by itself, so your thumb learns where things are.

### Pins

- **Hold** any entry on the sheet to pin it, or to unpin it.
- Pins sit on top of the sheet, always in the same order. Up to six.
- A pinned entry also stays in its Module's group, so nothing else shifts.
- Reorder or remove pins in [Settings](settings.md) under **Capture pins**.
- Pins belong to the Workspace. A new Workspace starts with none.

### Folds

- Some entries stand for several: Culture's **Add to Culture…** asks which medium (a book, a
  film, an album…), then opens that one's own form.
- The others: **Mark done…** and **Next part of…** in Culture, and the Calendar's **Add today…**.
- Everything inside a fold can still be pinned, and found in the palette.
- A [Macro](settings.md) whose steps are all capture, none of them going anywhere, is capture too: it gets its own **Macros** group on the sheet and can be pinned. A Macro with any other step stays off the sheet. A pin of a deleted Macro, or one that stopped being capture, disappears.

## The command palette (Ctrl+K)

Press **Ctrl+K** (⌘K on a Mac) anywhere. Type to filter.

- **Opened empty** — your capture pins on top, in the sheet's order.
- **Capture** — every capture Command. When you type, these rank first, folded ones included:
  "movie" finds "Add movie…" directly.
- **Go to** — this Workspace's Modules, its Screens, the Calendar and each of its views
  (Upcoming, Day, 3 Day, Week, Month), the Map, and every App's own pages.
- **Commands** — every other Command: "Go to Graph", "Open … Base", the Private folder's lock,
  and each Module's own. Each Module's page in this Guide lists them.
- **Guide · …** — every page of this Guide by name, under Go to: "guide money" finds it.
- The palette is never limited by the Workspace's Modules: everything is reachable from here.
- It does not search inside Documents; for that use the Vault's **Search**, or a Base.
- A Command you gave a key shows that key beside it. Pressing the key runs it without the
  palette; see [Settings](settings.md).

## Commands typed in one line (`!`)

Put **`!`** in the line and the palette reads it as one Command with its details, instead of
searching:

    !task call mum /fri #family @Family estimate:30

- **`!`** names the Command, anywhere in the line ("call mum !task" works too). A bare `!`
  lists every Command, and typing narrows it (`!ta` → Add task); Enter on a suggestion puts it in
  the line.
- **Plain words** are the Command's content: a Task's title, a Need's thing.
- **`/`** gives a date or a time, in English or French: `/tomorrow`, `/fri 5pm`, `/in 3 days`,
  `/next week`, `/24 oct`, `/2026-11-02`, `/demain`, `/ven 9h`, `/lundi prochain`,
  `/dans 2 semaines`. A weekday is the coming one, never today. As you type it suggests the days
  it could be (`/ve` → vendredi, with its date), and the top row shows the day it took. Where the
  two languages disagree (`/mar`: March or mardi), your preferred language in
  [Settings](settings.md) decides; both are always understood.
- **`#`** picks one of the Command's options (`!mood #great`), or adds a Tag. It suggests both.
- **`@`** links a Document by its exact title (`@Dune`), and suggests only Documents of the kind
  that Command links to.
- **`key:`** gives any other detail by its name: `estimate:30`, `notes:"oat milk"`. With nothing
  typed after a space, the palette suggests the details not given yet.
- **Quotes** turn the marks off: `"Buy #1 fan gift"` stays as written. A mark counts only with a
  letter straight after it, so "Super !" is just text, and links (`https://…`) are left alone.
- The top row shows what was understood ("Add task · call mum · #family"). **Enter** records it
  at once when everything needed is there. When something is missing, a title matches several
  Documents, or the Command has no way to run without its form, Enter opens the Command's form
  instead, already holding what the line understood: the title, the Tag, the day, the Source. A
  form shows only the details it has a field for. When the App refuses (a Need already on the list), the palette says why and nothing
  is written.
- One line runs one Command: a second `!` is pointed out, and Enter does nothing.
- Without `!`, the palette searches exactly as above.

## Tips

- On the desk there is no sheet: the palette is how you capture. Pin your daily few so they show
  the moment you press Ctrl+K.
- Capture is for leaving a record. Starting something live (a workout timer) lives on its
  Module's page.

## Related

- [Using Lifeline on a phone](phone.md)
- [Settings](settings.md)
- [Workspaces](workspaces.md)
- [Calendar](calendar.md)
