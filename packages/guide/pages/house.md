# House

What the house asks of you: the chores to do, the food you have, and what to buy next.

House has five places: **Home**, **Chores**, **Pantry**, **Shopping** and **Calendar**.

- **Home** is House's Overview — Cards on a grid. It starts with **Chores due today**, the
  **Shopping list**, **Running low** and **Expiring soon**. Tap **Edit** to move, resize, add
  (**Add card**) or remove Cards; **Reset to default** brings back the starting layout. Each
  Workspace keeps its own arrangement.
- **Calendar** is the Calendar scoped to your Chores, in **Month** and **Upcoming** only (chores
  have no hours). It keeps its own day and view, apart from the main Calendar.

## Chores

Housework that comes back: each chore has a schedule and is due again once done.

- **Schedules** — weekly (pick weekdays), monthly (a day of the month), yearly (a date), or
  "every N days after done", which counts from the last time you did it.
- **The Chores page** — your chores grouped as Overdue, Due today, Upcoming, Paused and Archived.
  Tick the round button to mark one done today. The **…** menu edits, pauses or resumes,
  archives or restores, and deletes.
- **New chore** — name, Tags and schedule. Where: the Chores page (Phone dock on a phone).
- **Add chore** — the same form from the palette (Ctrl+K).
- **Complete a chore** — lists what is overdue or due today; tap each one you did. Where: the
  palette.
- **Chores due today** — a Card: today's and overdue chores, ticked off in place, with how many
  days late. Where: a Card you can place; on House's Home by default.
- **Chore heatmap** — a Card: completions per day over the last weeks (4–52, 12 by default), for
  all chores or one you pick. Where: a Card you can place.
- **Peek** — open a chore from a link or a Base to see when it is due, mark it done, pause,
  archive, or change its schedule in place.

## Pantry

The food the house holds and where: each **Provision** is one product in one **Storage** (a
freezer, a fridge or a shelf), with a count.

- **Storages** — start with **New storage** (name and kind). A storage can only be deleted once
  it is empty.
- **The Pantry page** — every storage with its provisions. Tap **−** / **+** to keep the count
  honest; tap a name to edit it. **Search the stocks…** narrows the list. Badges up top say how
  many are running low and how many to check by date.
- **Quick add** — type a product, pick a storage, press Enter. The same name in the same storage
  adds one more instead of a duplicate. Where: top of the Pantry page.
- **Add provision** — the full form: product, storage, quantity, unit ("500g pack"), minimum,
  expires (a check-by hint) and frozen on. Where: **Provision** on the Pantry page, **+** beside a
  storage, the palette, or the Capture sheet.
- **Go to Pantry** — opens the Pantry page. Where: the palette.
- **Running low** — a provision under its minimum, or at zero. A running-low row has a **Hand
  off** button that sends it on — to the Shopping list, for instance.
- **Running low** (Card) — every provision under its minimum or out. Where: a Card you can place;
  on House's Home by default.
- **Expiring soon** — a Card: provisions to check by date, soonest first, within a window you set
  (7 days by default). Where: a Card you can place; on House's Home by default.
- **Storage** — a Card: one storage's contents with **−** / **+**, e.g. the chest freezer. Where:
  a Card you can place (pick the storage).
- **Pantry quick add** — a Card: the one-line add, with a default storage. Where: a Card you can
  place.
- **Peek** — a provision opened from anywhere: count it, move it to another storage, set unit,
  minimum and dates, hand it off when low.

A count of 0 keeps the provision: it is out of stock, not gone. Delete it from its form if you
never buy it again.

## Shopping list

Anything to buy at the next chance, written in seconds. Each thing is a **Need**; **Aisles** are
your own headings ("Supermarket", "Pharmacy"), in the order you walk them.

- **The Shopping list page** — needs with no aisle first ("Anywhere"), then each aisle. Tick a
  need when it is in the basket: it greys in place so a wrong tick is easy to undo, then moves to
  **Bought recently** (the last 7 days). Tap a need to rename it, change its note or aisle, or
  delete it.
- **Aisles** — **New aisle** adds one; beside each heading, arrows move it earlier or later in
  your walk, the pencil edits it, **+** adds a need there. Deleting an aisle keeps its needs, now
  buyable anywhere.
- **Add need** — type a thing and press Enter; the box clears for the next ("milk ⏎ eggs ⏎").
  Things you bought before are offered as you type. **Aisle & note** opens the extra fields.
  Where: **Need** on the Shopping list page, the palette, or the Capture sheet.
- **Go to Shopping list** — opens the list. Where: the palette.
- **Shopping list** (Card) — the list by aisle, tickable in the shop. Where: a Card you can place;
  on House's Home by default.
- **Peek** — a need opened from anywhere: mark it bought or put it back, edit its note and aisle.

One need per thing: adding something already on the list changes nothing, and typing something
you bought before puts it back on the list with its aisle and note.

## Capture

The Capture sheet (the **+** in the middle of the Phone bar), under House, offers:

- **Add provision** — a provision into a storage.
- **Add need** — something for the Shopping list.

On the desk, type either into the palette (Ctrl+K). **Add chore** is in the palette, not the
Capture sheet.

## Ask Claude

Through the Lifeline connector, Claude can:

- Add a chore with its schedule — "Add a chore to water the plants every Saturday",
  `chores_add`.
- Add a provision to a storage — "Put two bags of peas in the chest freezer", `pantry_add`. It
  will not duplicate one already there.
- Add to the shopping list — "Put milk on the shopping list", `shopping_add`. A thing already on
  the list is reported, not repeated.
- See what is due and tick it off — "What chores are due today?", `agenda` then `complete_item`.

## Tips

- A chore that is overdue stays on today's Calendar until you do it; it never piles up as copies.
- A chore with history cannot be deleted — archive it instead, and its heatmap stays.
- A staple that keeps running out belongs in the Pantry with a minimum, not on the Shopping list
  each week: when it runs low, hand it off to the list.
- Delete a need (from its form) to stop it being offered back when you type.

## Related

- [Calendar](calendar.md) — chores on their days, with every other dated thing.
- [Capture](capture.md) — the Capture sheet and pinning.
- [Screens and Cards](screens.md) — placing these Cards on your own Screens.
- [Peek](peek.md) — opening a chore, provision or need where you are.
