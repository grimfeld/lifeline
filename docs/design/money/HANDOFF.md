# Money: design handoff

The settled design of the Money module, for implementation in Lifeline. Put this folder at
`docs/design/money/` in the repo.

| File | What it is |
|---|---|
| `reference.html` | The working design in one file. Open it in a browser and compare against it. All data is made up; nothing is saved. |
| `money.css` | The design's stylesheet: one layout, two looks, two themes. The source of every colour, radius and type choice below. |
| `prototype.dc.html` | The prototype's source (template plus one logic class). Read it for exact behaviour: what each control does, wording of toasts and errors. It is not app code and uses none of the kit. |
| `PROMPT.md` | A prompt to start Claude Code with. |

Written against `master` at `a37571c`. Screens were checked against `packages/guide/pages/money.md`,
`shell/src/modules/money/MoneyModule.tsx` and the screens, dialogs and commands of `apps/ledger`,
`apps/pocket` and `apps/prices`.

## 1. What is decided

1. **One layout, two looks.** Money has one layout ("Cockpit") and two looks, **Pro** and **Play**.
   A look changes visuals only: tokens, type, radius, borders, shadows. No look adds, removes or
   moves content. Anything that differs between the two beyond dressing is a bug.
2. **Each look has a dark and a light theme.** Four combinations in all.
3. **The user chooses in Money's own Settings**, a new screen that holds settings for the Money
   module only: Look, Theme (Dark, Light, Match my device) and the Overview's Cards.
4. **No Transaction is added by hand from Money's screens.** There is no "Add transaction" button.
   Transactions come in through Import. An existing Transaction can still be edited and deleted.
   See § 6: this contradicts code that exists today and needs Paul's ruling on its reach.
5. **Phone: what you tap sits at the bottom.** Navigation at the very bottom, the screen's tabs just
   above, and one floating button above the tabs for the screen's one action. This is ADR 0064's
   intent; § 4 lists where the design is stricter than today's screens.

## 2. The layout

- **Desk.** A rail on the left (Overview, Pocket, Transactions, Budget, Reports, Prices; Settings
  and Hub at its foot). A title bar: the place's name, "Workspace · month", and **Import statement**
  on the right. Below it the page: a control row first, then Cards on a three-column grid.
- **Phone** (below `md`). The rail becomes the bottom bar, eight items, icon over label. The title
  bar keeps the title only. The control row becomes a bar pinned above the bottom bar, the main
  switch nearest the thumb. Dialogs become bottom sheets with their actions pinned.
- **Cards** carry an uppercase label, then content. A row that opens something is a whole-row button.
- **Numbers** are tabular everywhere. Negative amounts use the "−" sign, not a hyphen.

## 3. Screens

Every place and what it must hold. "Existing" means the app has it today and the design restyles
it; "changed" and "new" are called out.

Place ids, as `reference.html` takes them in its address (§ 11): `overview`, `pocket`,
`transactions`, `budget`, `reports`, `prices`, `settings`.

### Overview

Six Cards, shown and ordered from Settings: Net worth (figure, change since the 1st, curve),
Budget used (ring), Balances, What's left (Pocket as gauges; tap one to spend), Upcoming bills,
Budget this month. An Allowance with nothing left shows a dashed empty gauge and the word "empty";
one overspent shows the overspend in the negative colour.

The app's Overview is already a rearrangeable page of Cards (ADR 0066). Keep that mechanism. The
design only asks that show, hide and order are also reachable from Money's Settings. **Resize is
not designed**: keep today's behaviour.

### Pocket

- Control row: "n running · €x left in all", **New allowance**, **Spend**.
- **Now**: one Card per running Allowance: face, name, period, what is left (large), "left of €x",
  a bar, then **Spend** and an "n spends" chip.
- **Changed:** the chip opens the Allowance's Spends **inside its own Card**, not in a sheet at the
  bottom. Each Spend is a row (label, day, amount) that opens **Edit spend** (amount, label, day,
  Delete). **Edit allowance** sits under the list.
- **New:** an empty Allowance. At zero left: dashed border, no fill, the word **Empty**, "all €x
  spent · period", **Add to it** becomes the primary button and Spend the secondary. Overspent:
  same, with "€x over" in the negative colour and a full bar in that colour.
- **Upcoming**, then **Past** (folded, with a count), with **Renew** and **Renew all**. A custom
  span does not renew and says so.
- Dialogs: Spend (Allowance, amount, label, day, **Save & add another**), New and Edit allowance
  (name, face, amount, colour, period: this week, this month, this year or your own span; Delete
  asks twice, "Really delete").

### Transactions

Four tabs, as today.

- **Transactions.** Desk control rows: month arrows with the month, **All time**, search (payee,
  note, amount, date), sort (Newest, Oldest, Largest, Smallest, Payee A–Z); then filter chips for
  Account, Category and Kind (All kinds, Expenses, Income, Transfers, Adjustments).
  - Banners: "n payments say only PayPal" with **Name PayPal payees**; "n imported transactions
    have no Category yet" with **Show only those** and **Auto-categorize**.
  - A row opens **Edit transaction**: amount, day, Account (From and To for a transfer), payee,
    Category, note, For, Tags; Delete; and **Merge into one transfer** when the other side of the
    same movement is found in another Account.
  - **Changed on the phone:** the control bar is the four tabs only, full width, fixed size, never
    scrolling. Filters are a round floating button above the tabs, with a badge counting active
    filters. It opens a bottom sheet holding every filter and the sort, with Clear and Show. One
    line above the list says what is being shown ("November 2026 · Carte · expenses").
- **Accounts.** Each Account: name, kind, count, balance, **Reconcile**, **Import**, **Edit**; net
  worth beneath. Edit: name, kind, opening balance, **Archive**, Delete (refused when in use).
  Archived Accounts sit in their own section with **Unarchive**. Phone: floating **+** for New account.
- **Rules.** Search; **Your rules** (payee text, match "contains" or "exactly", Category or never)
  with **Apply to history** and **Edit**; **Guessed from your history** with **Pin as a rule** and
  **Never**. Apply to history opens the preview: every affected Transaction ticked, "Changes
  spending in N past months", Select all, **Recategorize n**, then a toast with Undo. Saving a rule
  that would change something offers **Review**. Phone: floating **+** for New rule.
- **Recurring.** Each series: payee, rhythm, next due, amount, **Skip**, **Mute** or Unmute.
- **Import** (title bar on the desk, an Account's Import on both): Account, file kind (CSV or
  OFX/QFX), date format for a CSV. Keep today's `ImportDialog` (column mapping, preview with ticks,
  duplicates skipped); the prototype only stands in for it.

### Budget

- Control row: month arrows, **New category**.
- A ring Card (percent used, spent, left) and the Categories, **grouped by their Group**, each a
  row: name, "spent / Target", a bar. Over budget turns the figures and the bar negative. A pot
  reads "€x saved". A Target changed for this month only says so.
- A row opens **Edit category**: name, emoji, kind (Expense, Income), Group, monthly Target, Target
  for this month only, Accumulating, and Delete, where a used Category must merge into another
  ("Merge & delete").
- Uncategorized spending has its own banner with **Categorize**.

### Reports

- Tabs: Overview, Categories, Budget, Recurring. Period chips on the desk (Last 12 months, This
  year, All time) and **Filters**: period including your own two months, Account, Category or
  Group, minimum amount, payee or note, import inbox counted or excluded, Clear. One line under the
  controls says what the window is. Phone: tabs only in the bar; Filters is the floating button.
- **Overview**: five figures (Income, Spending, Net, Savings rate, Best month), income against
  spending per month, top payees (by amount or by count), balances with net worth.
- **Categories**: a ring, a month-by-month stack (Amounts, or each month as 100%), and the
  Category × month table, sortable by any column, a month included. On the phone the table drops
  its month columns and keeps Total, Avg, Share, Trend.
- **Budget**: Targets against spending across the window, pots included, each row over or under.
- **Recurring**: fixed against variable, and what each series costs a year.

### Prices

- Tabs: Products, Receipts, Change, Overview, Shops. Desk: **Price** and **Receipt** on the right.
  Phone: one floating **+** that asks what to add (receipt, price, product, shop).
- A banner when lines **need an amount**, with **Retype**.
- **Products**: search; each Product with its cheapest shop and unit price; **+ Product**. A
  Product's page: what it is priced by, Edit, statistics, unit price over time by shop, latest
  price per shop with "cheapest", and every price (day, shop, amount, bought or noticed).
  Edit product: name, dimension and unit, "also measured" for a count, tags, **Merge into another
  product**, and **Change measure** (which creates lines that need an amount).
- **Receipts**: filter (All, Bought, Noticed only, Unmatched); each Receipt with shop, branch, day,
  line count, photo mark, "total differs" and "n unmatched". A Receipt's page: lines (label,
  amount, promo, price, Product) with **Match** or **Change** and **Remove**; a note when the lines
  do not add up to the printed total; **Add line**, **Add photo**, **Delete receipt**.
- **Change**: span chips (3, 6, 12 months); per shop, how prices moved; an empty line when nothing
  was bought twice at one shop.
- **Overview**: Spend, Shops, Overpaid, Promo saved, over the span.
- **Shops**: each Shop with its note; a row opens Edit shop (chain, note); **+ Shop**.
- Dialogs: New receipt (shop, branch, day, printed total, bought), Add line (label, paid, amount,
  promo, Product), Add price (Product, shop, price, amount, day, **Bought it**), New and Edit
  product, New and Edit shop, Match, Retype.

### Settings (new)

Money's own settings. Reached from the rail (desk) and the bottom bar (phone). Three sections:

- **Look**: Pro or Play, each a tile with a small swatch and one line; the one in use is marked.
- **Theme**: Dark, Light, Match my device. One line says what that means right now.
- **Overview cards**: each Card with Shown or Hidden and up and down; Reset.

It applies at once, to Money only. Where it is stored is yours to decide (see § 7).

## 4. Phone rules, where the design is stricter than today

- A control bar is **one row** wherever it can be. Tabs take the whole row at a fixed size; they
  never scroll and never change width from one tab to the next.
- A screen's single action (Filters, New account, New rule, Add to Prices) is a **floating round
  button** just above the tabs, 48px, at the right. It may carry a count badge.
- Filters never sit in the bar on a phone; they open as a **bottom sheet**.
- The control bar is flush with the bottom bar: no gap, full width.
- A toast leaves after six seconds and never blocks the controls under it.
- Targets are at least 40px tall in the control bar and 44px in the bottom bar.

## 5. Looks and themes

Look ids: `pro`, `play`. Theme ids: `dark`, `light`. `reference.html` takes them in its address (§ 11).

A look and a theme are tokens plus dressing. `money.css` has them as `.vP` / `.vG` (look) and
`.tD` / `.tL` (theme). Map them onto the kit's tokens rather than adding raw colours (ADR 0079).

| Design token | Use | Kit token it maps to | Pro dark | Pro light | Play dark | Play light |
|---|---|---|---|---|---|---|
| `--bg` | page | `--background` | `#181c20` | `#f4f1e8` | `#23211e` | `#fff7e8` |
| `--panel` | cards, inputs | `--card` | `#1e2328` | `#faf8f2` | `#2c2a26` | `#fffdf8` |
| `--raise` | hover, tags, quiet buttons | `--muted` / `--accent` | `#282e34` | `#ebe6d5` | `#3a3731` | `#ffecc8` |
| `--ink` | text | `--foreground` | `#cdc9be` | `#2a3630` | `#d9d2c5` | `#3a342d` |
| `--mute` | secondary text | `--muted-foreground` | `#969e97` | `#5b685f` | `#aaa193` | `#6b6257` |
| `--line` | hairlines | `--border` | `#313940` | `#cfd3c8` | `#403c35` | `#ead9b6` |
| `--acc` | primary button, ring, selected | `--primary` | `#bfab78` | `#1f5c43` | `#e8c36a` | `#5a3df0` |
| text on `--acc` | | `--primary-foreground` | `#181c20` | `#f4f1e8` | `#23211e` | `#fff7e8` |
| `--pos` | income, under budget | `--success` | `#74c79a` | `#1f5c43` | `#7fd1a6` | `#0c7a4d` |
| `--neg` | over budget, errors | `--destructive` | `#e58f80` | `#a3271a` | `#ee9a8b` | `#c2371f` |
| `--track` | empty bars and rings | `--secondary` | `#2e353b` | `#dcd8c8` | `#413d36` | `#f0e2c6` |
| `--ol` | Play's outlines and shadows | new, Play only | | | `#14120f` | `#8c7b62` |
| `--rule` | Pro's rule on top of a card | new, Pro only | `#5a636b` | `#93a096` | | |
| `--rail` | Pro's rail | `--sidebar` | `#121518` | `#1f5c43` | | |

Dressing, per look:

| | Pro | Play |
|---|---|---|
| Titles | IBM Plex Serif 600 | Bricolage Grotesque 800 |
| Body | Inter | Figtree |
| Figures | IBM Plex Mono, tabular, slightly tight | Bricolage Grotesque |
| Radius | 2px everywhere | cards 18px, buttons 13px, chips pill |
| Card | 1px hairline, a 1.5px rule on top | 1.5px outline, 3px hard shadow in the outline colour |
| Labels | 10.5px, uppercase, wide tracking, accent colour | 12px, bold, sentence case, ink |
| Buttons | flat | 1.5px outline, small hard shadow, presses down |
| Rail | darker than the page (green in light) | the raised tone, outlined |

Category and Allowance colours are data (colour slots), the same in every look.

Every text and control in all four combinations measures at least 4.5:1 against its background in
the prototype. Keep that true: check it again after mapping onto the kit's tokens.

## 6. Where the design differs from the app today

These are behaviour changes, not styling. Each needs its Guide page updated (ADR 0089), and the
first needs an ADR.

1. **Add transaction is gone from Money's screens.** Today: `ledger.add` ("Add transaction", the
   **+** on `RegisterScreen`, the Capture sheet, the palette, a Card), "Add transfer" in the
   palette, and the connector's `ledger_add`. Paul's decision is that Transactions are always
   imported from a bank statement. **Open question for Paul before coding:** does that remove the
   command everywhere (Capture, palette, Card, `ledger_add`), or only the button on the
   Transactions screen? The design covers Money's own screens only. Do not delete the command,
   the Card or the connector tool without his answer. Editing, deleting and merging into a
   transfer stay.
2. **Import statement** moves to the title bar on the desk, as Money's main action.
3. **Pocket** shows an Allowance's Spends inside its Card, and has the empty and overspent states.
4. **Transactions on the phone**: tabs only in the bar, filters in a sheet behind a floating button.
5. **Reports and Prices on the phone** follow the same pattern (tabs in the bar, one floating button).
6. **Settings** is a new place in the module, with a route, a Guide entry and a row in `SCREENS`
   (`shell/e2e/screens.spec.ts`).
7. **Looks and themes per module** are new. The kit has one token set and a `.dark` class today.

## 7. Yours to decide

- **Where the look and theme live**: per Workspace, per person or per device, and how a module's
  theme sits beside the app's own dark mode. "Match my device" should follow the app's existing
  theme source if there is one, not a second media query.
- **How a module scopes its tokens**: a wrapper on the Money shell that re-declares the kit's
  tokens is the smallest change, and keeps every kit component working unstyled.
- **Fonts**: the two looks use four families the app does not ship today. Self-host them; load a
  look's fonts only when that look is in use.
- **Charts**: the prototype draws bars, rings and stacks with plain boxes. Use the app's existing
  chart components and give them the look's tokens.

## 8. Do not copy from the prototype

- The data: accounts, payees, eighteen months of made-up history, prices, receipts.
- Import: it always brings in the same two lines.
- "Name PayPal payees": it has no real file behind it.
- Price change percentages per shop: fixed numbers.
- The net worth curve: a fixed shape.
- "Add photo": it only counts.
- Days and periods as short lists ("Today", "Yesterday"): use the app's date fields.
- The prototype's markup, class names and hand-made controls. Build from `@lifeline/ui`.
- The Hub button: the hub is not designed yet. Keep today's way out of the module.

## 9. Left as it is

Outside Money's own screens, so not redesigned: the Capture sheet, the palette commands, Peeks
(Transaction, Category, Product, Allowance), Money's Cards placed on other Screens, Bases, and the
connector. They should pick up the look's tokens only where they render inside Money.

## 10. Done when

- [ ] Each place in § 3 matches `reference.html` in both looks and both themes, desk and phone.
- [ ] Switching look or theme in Settings changes nothing but visuals: same elements, same order.
- [ ] `pnpm check:ui` passes; no raw colour, no control hand-rolled where the kit has one.
- [ ] Text contrast is at least 4.5:1 in all four combinations.
- [ ] On the phone, every control bar is one row where § 4 says so, flush with the bottom bar, and
      tabs do not scroll or resize.
- [ ] Long content survives (ADR 0065); Settings has its row in `SCREENS`.
- [ ] `packages/guide/pages/money.md` says what the screens now do.
- [ ] The question in § 6.1 has Paul's answer, and an ADR records it.

## 11. Viewports, and opening one view by its address

Two viewports. The layout switches below 768px, the app's `md` line.

| Viewport | Width |
|---|---|
| desk | 1280px |
| phone | 390px |

`reference.html` opens any view straight from its address, for screenshots taken by a script:

    reference.html#place=<place>&look=<look>&theme=<theme>

- `place`: `overview`, `pocket`, `transactions`, `budget`, `reports`, `prices`, `settings`. Default `overview`.
- `look`: `pro`, `play`. Default `pro`.
- `theme`: `dark`, `light`. Default `dark`.
- `tab`, optional, opens a tab of the place. `transactions`: `transactions`, `accounts`, `rules`,
  `recurring`. `reports`: `overview`, `categories`, `budget`, `recurring`. `prices`: `products`,
  `receipts`, `change`, `overview`, `shops`.

A page opened this way shows the view alone: no bar, intro, hint, toast or feedback panel over it.
The module fills the window, so the window's width is the viewport: 1280 wide gives the desk
layout, 390 wide the phone layout. Example, the phone Budget in Play, light, in a 390px window:

    reference.html#place=budget&look=play&theme=light

The same views have a plain name, for hosts that pass only a simple `#name` (the claude.ai
artifact link does): `#shot-<place>-<look>-<theme>`, for example `#shot-budget-play-light`.

