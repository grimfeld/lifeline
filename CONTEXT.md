# Lifeline — Context

Glossary of domain terms for Lifeline, the personal dashboard/OS. Implementation details live elsewhere.

One shell, one Document store. Hand-written Apps own built-in Document types and their behaviour; user-defined types get Core's generic behaviour; everything is shown through Cards, Screens, Surfaces, App screens and Bases, and interoperates only through Contracts defined by the Core.

## Glossary

### Document
The one basic block everything in Lifeline is made of. Every record a user can see — Task, Chore, Event, Stat, Entry, Media item, Quote, Source, Note… — is a Document of exactly one **Document type**. Every Document has a title (free, dated, or **derived** read-only from its fields as the type decides), typed fields, Tags, a Folder (root by default), and — where its type allows (required / optional / none) — a markdown body; the fields double as that body's frontmatter properties. Contracts (Schedulable, Linkable, Locatable…) apply to Document types; Cards, Screens, Surfaces, Bases and Apps all present or process Documents and never anything else.
_Avoid_: record, entity, item, page, file, note (one type), block (a body fragment)

### Document type
The kind of a Document: its field schema, title rule, body policy and the Contracts it implements. Adding a type is meant to be cheap and automatically yields a Base. A type may be **internal**: its Documents exist only in service of another Document (a Writing's Versions) and are hidden from the Vault tree, link completion and the sidebar, and are neither a target nor a *source* of link relations — their wikilinks, Link fields and Tags belong to the Document they serve, so they raise no backlink, Ghost, tag entry or Unlinked mention of their own — though they still have a Base. Two origins, one registry: **built-in** types are defined in code and are the only ones an App's behaviour may depend on; **user-defined** types are created in-app and get everything generic (Base, form, body, generic Cards) plus the Contracts that can be declared from data alone — a Contract with behaviour hooks needs code. Subsumes the old "Note type".
_Avoid_: schema, collection (storage detail), category, template (a part of a type)


### App
A hand-written domain module (Chores, Stats, Media, Tasks…) living inside the shell. Owns one or more built-in Document types: it alone defines their behaviour — Contract hooks, commands, rules, and which fields are **guarded** (editable only through the App's own operations — never by a Base's raw write, and read-only when the Document is opened as text). Any App or generic tool may *read* any Document; semantic operations go through the owner. Apps are never generated per type; user-defined types have no owning App and are served by Core's generic behaviour.
_Avoid_: plugin, widget, service, processor

### Core
The neutral part of the system: shell, Contracts, sync layer, command registry, the Document store and type registry, Bases, Surfaces and generic Cards. Owns no Document types; its own bookkeeping — Screens and Card instances, Placements, Views, user-defined type definitions — is synced but is *not* Documents (Documents are user-facing content only).

### Account
One sign-in, owning its own Documents and Core bookkeeping (Screens, Placements, Views, user-defined types, Attachments) outright. Nothing is shared or visible across Accounts; the server, never the client, decides which Account a record belongs to. One device holds one Account's data at a time.
_Avoid_: user (the human), tenant, workspace, profile

### Contract
An interface defined by Core that a Document type implements (Schedulable, Timed, Loggable, Linkable, Locatable, Taggable, Daylog…). Carries data shape *and* behaviour hooks — the consuming Surface calls the hook; the owning App decides what happens. Built-in types implement Contracts in code; user-defined types may declare the data-only ones (e.g. Locatable through a geo field). The five things that serve Documents — Card, Screen, Surface, App, Base — are *not* Contracts and have no collective name.
_Avoid_: capability, trait, API, decorator

### Schedulable
The first Contract: an entity that can be placed onto a time surface (calendar, week view). The owning App supplies title/identity/status and behavior hooks — e.g. what completing a placement means, and what happens when a placement's time passes uncompleted (keep / roll forward / drop). A Chore rolls its placement forward until completed; a simple task's placement just passes.

### Timed
The second Contract: an entity that happens at a fixed time on a day (start/end, or all day) and is not work — nothing to complete. Surfaces draw Timed items above the day's Schedulable work. The Calendar App's Events are the first implementation; the owning App may allow moving them to another day, may offer Event templates for quick add, and may report background items — Time blocker bands, which hour-scaled Surfaces paint behind everything and day-granular ones leave out.
_Avoid_: appointment (that's an Event, one implementation), block

### Loggable
A Contract: an entity that accepts a logged occurrence from any other App — a Stat takes an Entry (a value at a moment), a Habit takes a Completion (a moment, a note). The owning App lists its targets and does the logging; the sending App only names the target and the moment. How Workout Sessions feed Habits and Stats; open to Chores and Tasks later.
_Avoid_: trackable, sink, hook (the Contract's own word for its functions)

### Tally
A Workout's standing instruction to log each of its Sessions somewhere Loggable — "tallies to Habit *Train*", "tallies to Stat *Minutes trained* (+duration)". Carries the target and what value to send (one, the duration, a Block's result). Fires when the Session is saved, never again.
_Avoid_: feed (a Source kind), sync, bridge (the idea, not the thing), hook

### Placement
A Schedulable entity's assignment to a day — and optionally a time slot — on a surface. Owned by the surface (Core), referencing the foreign entity by App + id; the time is the surface's, never the App's (a Task still only knows its day). An entity may have any number of Placements — several Time blocks across several days — and none of them moves the entity's own day. Distinct from the entity itself: deleting a Placement never deletes the entity. Subsumes calendar's old "TimeBlock".
_Avoid_: TimeBlock, occurrence, booking

### Time block
A Placement that carries a start (and end) time: one planned stretch of an item in the Schedule's hours. An item may have as many Time blocks as it needs — a long Task split over Monday and Wednesday — on any days, without its own day changing; a block is planning, never the item. A block has no done state of its own: its tick is the item's tick and completes the item, which then drops every block still ahead (starting after the moment of completion) and keeps the past ones as record. Blocks show where hours show — the Schedule, the Agenda card — and in the Today feed as that day's work; day-granular planning views (Week planner, month Calendar) show the item on its own day only. Dragged off the hours, a block is simply gone — into the pool, the item keeps its day; into a day's strip, the item takes that day. When the item rolls forward as overdue, the time is dropped. Blocks never repeat on their own.
_Avoid_: appointment, event (that's the Calendar App's timed thing), slot (the empty grid cell), session / instance / occurrence (of a block — say "a Task's Time blocks")

### Schedule
The hour-scaled Surface (day or week) where Time blocks and Events are laid out and dragged, over the bands of the day's Time blockers, beside the Event templates offered for quick add. Its chips — the pool and each day's untimed strip — are sources: dragging one onto an hour makes a new Time block and leaves the chip in place, greyed while blocks lie ahead; dragging a block moves that block alone. Distinct from the Week planner (day-granular) and the month Calendar.

### Base
The one bulk place for one Document type: every Document of that type, shown for sorting, filtering and bulk editing of plain fields (guarded fields go through the owning App). Exactly one per type, generated from the type — adding a type adds a Base. A Base holds **Views**.
_Avoid_: table (one layout), database, list, explorer

### View
A named, saved configuration inside a Base: filters, sort, visible fields and a **layout** — table, list, cards, gallery, map, board or calendar. A layout that reads one particular field (gallery's image URL, map's geo, board's group-by select, calendar's date) stores that field pick in the View and is only offered when the type has such a field; Documents the layout cannot place (no coordinates, no date) are left out but counted, never silently swallowed. Layouts display — they never bypass ownership: a board drag on a guarded field is a request to the owning App, which runs its real operation or declines (no App answer → that board is read-only), and the calendar layout never moves anything (moving through time is Surface work). Every Base starts with an "All" View; the user adds more ("To read", "Open · work"). A View is the unit you place on a Screen as a Card, rendered in its own layout wherever it appears.
_Avoid_: saved search, filter (one part of a View), base (the container), view type (say layout)

### Surface
A fixed, hand-written page owned by Core that shows Documents of *many* types together through a Contract, never through a type directly (Schedule, week grid, map, Today feed, Journal). Surfaces are general; Apps are specific. Distinct from an App screen (one App's own page) and a Screen (user-composed).
_Avoid_: page, dashboard, view (that's a Base's saved configuration), screen

### App screen
A fixed, hand-written page an App ships over its own types (Gallery, Chores, a Stat's detail page). Listed in the sidebar beside Surfaces and Screens, inside its Nav group.
_Avoid_: surface (Core-owned, cross-type), screen (user-composed), page

### Nav group
One shelf of App screens in the sidebar (Planning, Culture, Money, Study, Progress). Core owns the list, the titles and the order — the sidebar is Core's chrome (ADR 0012), and grouping is about the sidebar's length, not about ownership: a group is never a container, an App never belongs to one, and two Apps' screens sit side by side in the same group (Ledger's three screens and Pocket's under Money). An App only names the group each of its screens is listed under; naming none, or an unknown one, leaves the screen a plain top-level row. Groups start closed on every device and remember what the user opened (per-device, like a collapsed section or a hidden Base); the group holding the screen you land on opens itself.
_Avoid_: category, folder, section (the sidebar's own Screens/Surfaces/Apps/Bases headers), suite

### Command
A named action an App registers with Core, run from the global palette (Ctrl+K): navigation or domain action ("Complete chore…", "Log entry…"). Declares an argument signature from day one; v1 collects args via dialog, inline parsing may come later. A Command may be flagged **capture** — it records something in seconds (clip, log entry, quick capture) — and capture Commands are what the phone's "+" sheet lists.
_Avoid_: shortcut, action

### Screen
A user-created, named page composed of Cards on a grid layout (drag/resize). Users create any number. Apps also ship built-in full-page screens; the sidebar lists both.
_Avoid_: page, view, workspace

### Card
A self-contained UI block for use on Screens — small ("chores due today", "current streak") or large (full calendar grid). The unit of layout composition. A Card is a *kind*; what sits on a Screen is a Card instance. Two origins: **App Cards**, hand-written and registered by an App; and Core's **generic Cards** that work on any Document type — the **View card** (a Base View on a Screen), the **Document card** (one chosen Document, fields and body) and the **Count tile** (how many Documents a View holds). Capture/quick-add is always an App Card. Some Cards are **configurable**: they can't be shown without the user choosing something first (which Stat, which View, which Document).
_Avoid_: widget, block, tile (except Count tile), embed

### Card instance
One placed copy of a Card on one Screen, with its position and, for configurable Cards, its chosen settings. The same Card may be placed many times on a Screen with different settings (a "Push-ups" tile next to a "Weight" tile). Removing an instance never touches the entity it points at.
_Avoid_: widget, tile

### Phone home
The one Screen the phone opens as Home. On a phone, Lifeline is capture-and-consult: the phone home's Cards stacked in one column, a Journal tab, and a capture sheet of capture Commands; everything else stays reachable but is shaped for the desktop. Designated on a Screen ("Use as phone home"); at most one Screen holds it, on every device alike. The stack is edited where it is read: a Screen is composed on the phone as well as at the desk.
_Avoid_: mobile app (same app, one frame), home screen (the OS thing)

### Task
A unit of work owned by the Tasks App. One-time (optionally assigned to a day) or recurring. Absorbs calendar's old Task/Backlog and week-planner's tasks. Completable; implements Schedulable.
_Avoid_: todo, item

### Occurrence
One instance of a recurring Task, generated by its recurrence rule (weekly on weekdays, monthly on days of the month, or yearly on dates — month-length dates clamp like Chores). Each Occurrence completes and moves independently. Recurring Tasks have no single "done" state — only their Occurrences do. (Period-reopen semantics are not a Task concept; that need is served by the Chore App.) Occurrences are derived, never stored; only the ones that were moved or completed leave a sparse per-Occurrence override keyed by task + source day. A missed Occurrence **lapses** as soon as the rule produces the next one (ADR 0036): a recurring Task is overdue at most once — for the Occurrence it is currently on — and a lapsed one keeps its day as record, without urgency, still tickable there. Moving an Occurrence onto today or later takes it out of that reckoning.
_Avoid_: period, instance

### Unassigned
A one-time Task with no day yet. It lives in the pool (the "Unplaced" column of the week Surface and the Schedule) until dropped on a day. Giving it Time blocks does not assign it: it stays in the pool, greyed while a block lies ahead, ready to be blocked again. Recurring Tasks are never Unassigned.
_Avoid_: backlog, inbox, someday

### Move
Dragging a Schedulable item to another day on a Surface. The owning App decides what a move means (a Task changes its day; an Occurrence gets an override); an App that doesn't own moves gets a Core Placement pin instead. Moving an item back to the pool is only possible for Apps that own moves.
_Avoid_: reschedule, pin (a pin is the Core fallback, not the concept)

### Event
A thing that happens at a fixed time (start + end, or all-day), owned by the Calendar App. Not work, not completable. The Calendar App owns Events and the calendar Surfaces; it no longer owns Tasks.
_Avoid_: appointment, meeting

### Event template
A named shape for an Event the user adds again and again — "Standup", "Gym", "Dentist": title, length, usual start, notes, Tags, and no day at all. Quick-adding one on the Schedule (dropped on an hour, or added to the open day) creates an ordinary Event and then forgets the template: editing a template never rewrites the Events it made, deleting one never removes them. Owned by the Calendar App.
_Avoid_: template (bare — always "Event template"; a Note template is a different thing), recurring event (a template repeats only when you use it), preset, boilerplate

### Time blocker
A band of hours the user marks as already taken, in one of two shapes. **Weekly**: a rule — sleep, work hours, the school run — weekdays, a start and an end (past midnight when the end is earlier), and a colour; it lives on no day and is never dragged, since a drag would silently retime the rule. **One-off**: the same band on one day only — travel to the dentist, prep before a call — made by dropping a Blocker template on an hour, then moved and resized on the Schedule like any block; it is tied to nothing (the travel before a moved Event stays put until you drag it) and kept as record once past. Neither is an Event nor work: a blocker creates nothing and is painted behind the hours of every hour-scaled view (the Schedule, the Agenda card) as a guide to plan around. A guide only: nothing refuses a drop over a band. Day-granular views leave bands out; Tag filters never hide them, since a band is not content but the hours around it. Switching a weekly one off keeps the definition and stops the paint. Owned by the Calendar App.
_Avoid_: busy event, availability, Time block (that's one item planned into a slot), recurring event, travel event (travel is a one-off blocker)

### Blocker template
A named shape for a one-off Time blocker the user drops again and again — "Travel 30", "Prep 15": title, length, colour, and no day or rule; it paints nothing by itself. Dropping one on an hour of the Schedule makes a one-off Time blocker there and forgets the template, exactly as an Event template makes an Event. Owned by the Calendar App.
_Avoid_: template (bare — say which), buffer, padding

### Workout
A plan for a training session, owned by the Workout App: an ordered list of Blocks you launch on the timer in one tap — "Tabata warm-up → EMOM 12 → cooldown". Says nothing about when; running it on a day makes a Session. Not a Stat, not a Habit (those may be fed by Sessions).
_Avoid_: routine, program, WOD, session (that's one run of it)

### Block
One timed part of a Workout, in one **mode** — EMOM (a movement every minute), AMRAP (as many rounds as possible in a countdown), Tabata (8 × 20 s work / 10 s rest by default), For Time (count up to a cap), or plain Intervals — with the mode's few parameters and its Movements. Every mode is only a way of writing intervals: the timer plays the expanded work/rest sequence and does not care which mode wrote it.
_Avoid_: set, segment, phase, Time block (a Placement on the Schedule)

### Movement
An Exercise inside a Block with its dose — reps, load, seconds or distance — and an optional cue. EMOM alternates Movements by round; AMRAP and For Time cycle through them; Tabata takes one per interval. Always points at an Exercise: that link is what turns Sessions into PRs.
_Avoid_: exercise (that's the library entry), drill, station

### Exercise
A library entry, hand-curated by the user, owned by the Workout App: name, category (push, pull, legs, core, cardio, full-body), equipment, and its **measure** — the one number worth beating: load (with reps), reps, time, distance or calories. Movements point at Exercises; PRs belong to Exercises.
_Avoid_: movement (that's an Exercise inside a Block), lift, activity

### Session
One run of a Workout on a day at a time, owned by the Workout App and made by the timer: when it started and ended, each Block's result in its mode's own terms (AMRAP rounds + extra reps, For Time clock, rounds completed), what each Movement actually got when it strayed from the plan (load used, reps hit), notes. A Timed item on the time Surfaces and a "Worked out" fact in the Daylog. Deleting the Workout keeps its Sessions.
_Avoid_: workout (the plan), log, entry (a Stat's)

### PR
The best a Session ever reached for an Exercise, in that Exercise's measure — and for load Exercises the best load at 1, 3, 5 and 10 reps. Always derived from Sessions, never stored or declared; a Session that beats it is a PR the moment it is saved.
_Avoid_: record (a Document), best, max

### Stat
A named series the user tracks (push-ups, weight, workouts, countries visited). Defines what is tracked and how values are read — one of four kinds: **Additive** (entries add up), **Measurement** (point-in-time readings), **Boolean** (a day was done), **Collection** (distinct items collected, optionally against a universe size shown as a denominator). Holds no totals; kind is fixed after creation. Goals/targets are out of scope.
_Avoid_: metric, counter, habit (a Habit is the Life Level App's XP-bearing track — a Boolean Stat merely tracks days done), goal

### Entry
One logged event of a Stat: a value and the moment it happened (user-settable, backdating allowed), plus an item name for Collections. Totals, streaks and distinct counts are always derived from Entries, never stored; duplicates are collapsed at derivation, never rejected.
_Avoid_: log, record, data point

### Streak
A Boolean Stat's run of consecutive marked days. The current streak ends today or yesterday — an unmarked today doesn't break it. Derived, period-independent.

### Mood
How one day felt, on a fixed five-point scale — 😞 Rough, 😕 Meh, 😐 Okay, 🙂 Good, 😄 Great — one colour per step, owned by the Mood App as its only Document type. At most one per day (its title is the date); re-picking replaces it, and a day with none recorded is an absence, never a sixth mood. Settable on today or any past day — never a future one, which hasn't been felt yet. Reported to the Daylog, so the daily note still shows the day's mood; deliberately *not* Linkable — a date title would collide with the daily note's, and prose points at the day, not at the feeling. The scale is fixed in code so a colour means the same thing in every year of the grid. Was a `mood` field on the daily note until ADR 0044.
_Avoid_: entry (a Stat's word), completion (Life Level's), check-in, mood entry, feeling, rating

### Mood grid
The Mood App's screen: one cell per day, coloured by that day's Mood, toggling between one month and a whole year. The picture is the point — a year of colour read at a glance — and it doubles as capture: clicking a cell sets or clears that day's Mood. Also placeable as a Card in miniature, carrying the window's average and its week-over-week direction.
_Avoid_: heatmap (the Chores card's shape, and density rather than category), calendar, year in pixels (fine in prose)

### Habit
A positive activity the user wants to do, owned by the Life Level App. Completing one earns XP toward its Level; neglect bleeds XP away through Decay — standing still loses ground. Has a Difficulty. Distinct from a Boolean Stat (neutral did-I-do-it tracking): a Habit answers "how much ground have I gained or lost?". Not Schedulable — cadence is enforced by decay pressure, never by planning; "meditate on Tuesday" is a Task that links to the Habit.
_Avoid_: activity (the old umbrella word), routine, boolean stat

### Negative activity
A bad behaviour the user wants to avoid, owned by the Life Level App. Logging one drains XP from a Habit; has a Gravity and one of two targeting modes: **fixed** (permanently paired with one rival Habit it undoes — junk food → eat healthy) or **random** (each log rolls a fresh victim — unjust on purpose; the unpredictability is the deterrent). An anti-habit, meaningless without Habits: logging with no Habit to hit is blocked, never a whiff. A fixed Negative whose rival is deleted survives but is blocked from logging until re-paired or set to random — never silently switched.
_Avoid_: bad habit, vice (fine in prose, not the term), penalty

### Completion (Life Level)
One logged occurrence of a Habit or Negative activity: a visible ledger Document carrying the moment it really *happened* (occurred-at, user-settable — back-logging covers genuine forgetting) and an optional note. A Negative's Completion also records the Habit it hit: the persisted outcome of the fixed pair or the random roll — a fact, never re-rolled. Completions die with their activity ("honest quitting"): deleting a Habit deletes its own Completions and every Negative Completion that hit it — earned levels and XP debt die together; forfeiting progress is the cost of shedding debt.
_Avoid_: log (fine as a verb), check-in, entry (a Stat's term), occurrence (a Task's term)

### Difficulty
`easy | normal | hard | expert | master` — a Habit property, self-assessed, blending two axes: aversion (how unpleasant) and time cost (how long). Harder = more XP per Completion and gentler Decay. Re-assessing it is retroactive: the whole ledger re-values at the new Difficulty — "it was always this hard". The ledger stores facts; valuation is policy.
_Avoid_: gravity (the Negative axis), priority, weight

### Gravity
`minor | severe | catastrophic` — a Negative activity property: a single axis, the severity of the real-life consequence. Higher = more XP damage per log. Deliberately not a mirror of Difficulty — good is rewarded by *effort*, bad is punished by *harm*. Retroactive on edit, like Difficulty.
_Avoid_: difficulty (the Habit axis), severity (fine in prose)

### Raw XP
The signed, always-derived measure of a Habit's progress: Completion XP minus Decay minus Negative damage, computed from the ledger and the wall clock — never stored. Tuning is keyed only by Difficulty and Gravity — no per-Habit knobs. Negatives can push it below zero into **debt**, which must be climbed out of before progress resumes; Decay never can — the floors are asymmetric on purpose.
_Avoid_: score, points, total XP (no global total exists)

### Level (Life Level)
A per-Habit number derived from its Raw XP, floored at 1. Deliberately no global "character level" — life is many separate tracks, not one stat; the App name is aspiration, not a computed score. It moves with the clock alone (Decay), so it is always computed at read, never stored.
_Avoid_: rank, character level, life level (as a number)

### Decay
XP bleeding away while a Habit sits idle past a grace period. Harder Habits decay more gently — time-expensive habits can't realistically be done daily. Decay only erodes positive progress: it stops at zero; only Negatives dig the hole.
_Avoid_: rust, penalty (that's Negative damage), streak loss

### Ledger
The money App: Accounts, Transactions, Categories — and two derived lenses over them, the Budget and the Recurring series. Ledger-first: the ledger stores facts (Transactions); every total — balance, spent, pot — is derived at read, never stored. Nothing enters the ledger ahead of reality: every Transaction is a witnessed past event — a bank row imported, a purchase typed in after the fact, a reconcile gap — never a prediction, an expectation, or anything posted in advance. Lower-case "ledger" in prose means its record of Transactions (Life Level's Completions ledger is its own thing).
_Avoid_: budget app (the Budget is one lens), finance, money app, wallet

### Transaction
One movement of money on a day, owned by the Ledger App: an amount in integer cents (one app-wide currency), an Account, and a kind — **expense** (one expense Category), **income** (one income Category), **transfer** (a single Document with from-Account and to-Account; never spending — paying a credit card is a transfer, the expense happened at the swipe), or **adjustment** (the reconcile gap: type the real balance, the difference is recorded as a fact; category-less, excluded from reports). Also: free-text payee, a note field, Tags, an optional import id. A payee the bank wrote as one name for many merchants (every PayPal payment) can be **resolved**: a PayPal activity file the user hands over names the real merchant, which replaces the payee while the bank's own string is kept beside it — on import and, by a sweep, over history. No body, derived title, no time of day; backdating allowed. No splits — one Transaction, one Category; a receipt across two Categories is two Transactions (a UI helper may create them). Manual entry requires the Category; imported Transactions may arrive **uncategorized** and are shown loudly — an inbox to clear, never hidden, never auto-dumped, one quick filter away in the Register and composing with every other filter there.
_Avoid_: entry (a Stat's), record, expense (one kind), line item, split, payment

### Account
A named place money lives — checking, savings, cash, credit card — owned by the Ledger App, Linkable. Holds an opening balance and its saved CSV import mapping; its balance is always derived (opening plus its Transactions, transfers read from both sides; a credit card simply runs negative). Never deleted while Transactions reference it — **archived** instead: history kept, out of pickers and default balance views. Hard delete only when empty.
_Avoid_: wallet, bank (the institution), envelope

### Category
Where a Transaction is classified, owned by the Ledger App, Linkable: a kind (**expense** or **income**), a display group (plain field — two levels for reading, no policy at group level), a standing monthly Target, and an **accumulating** flag. Exactly one per Transaction. An accumulating Category is a sinking fund: its **pot** — all allocations minus all spending since its start, derived, never stored — rolls month to month and may go negative; next months' allocations climb out of the hole, nothing clamps. Deleting a referenced Category is blocked — merge into another instead. Tags stay orthogonal: free crosscutting words, never budget maths.
_Avoid_: tag, envelope, group (the display field), budget (the lens)

### Target
A Category's monthly amount of policy — "Groceries €400": a standing value on the Category, overridable for a single month by an **Allocation override** (an internal Document — December ≠ March, and the history of what was allocated stays honest). Spent is derived from the ledger; the Budget screen shows target / spent / available per expense Category for one month. A Category with no Target is **untracked**: the Budget lists it and shows what was spent, but claims nothing about it — no available figure, no overspent red, since there is no policy to break. An income Category may carry a Target; the Budget screen ignores it. Fresh each month unless the Category accumulates.
_Avoid_: budget (the whole lens), allocation (the override record), limit, goal

### Money reports
The Ledger's reading of itself over a stretch of months, and the one place that only reads: a window — a preset ("Last 12 months", "This year", "All time") or two months picked by hand — and one filter bar every chart shares (Accounts, Category groups, Categories, a minimum amount, free text over payee and note, the uncategorized inbox counted or left out), in four tabs. **Overview**: the window in five numbers, income against spending read as bars, lines or a running cumulative, balances at each month's end, and the biggest payees. **Categories**: the share as a ring, month by month as a stack (amounts or each month as 100%), and a Category × month matrix that sorts by any column, a month's own column included. **Budget**: each Category's Targets over the window against what it spent, month by month, accumulating pots, and a table sorted by what is most over. **Recurring**: each month's spending split **fixed** against **variable** — fixed is the month's Transactions that belong to a Recurring series, muted and dormant alike (dormancy is a forecast concept; history keeps its months) — and every series over the window: cadence, median amount, what a year of it costs, last seen, dormant badged. Every number is derived at read like everywhere else in the Ledger — Targets take the month's Allocation override where there is one, a pot is still read from full history — and nothing on the screen writes. Distinct from the Budget, which is one month and where policy is actually set.
_Avoid_: analytics, dashboard (a Screen), insights, statistics (the Stats App's word), charts (one part)

### Categorize rule
The user's own word over the Ledger's auto-categorization (ADR 0040), which is otherwise a *reading* of the ledger itself — the Category a payee last got is what its next import is suggested. A rule is a piece of payee text (matched with the bank's casing, digits and punctuation normalized away), read **contains** (anywhere inside the payee) or **exact** (the whole payee), and it either hands out one Category or says **never** — a veto that keeps the payee out of auto-categorization entirely, so its rows land in the uncategorized inbox for a human to pick. Never is for a payee that is one name over many categories: Amazon, where last-used is a coin toss. Precedence is fixed: never beats a Category rule, exact beats contains, the longest match beats a shorter one, and any rule beats history. A rule's kind is never typed in — a Category rule speaks for its Category's kind, a never rule for both. Rules only shape what is *suggested* — the import preview and the Auto-categorize sweep; nothing is written into the ledger unwitnessed. The Register's Rules tab shows both layers at once: the hand-made rules, and the derived reading underneath, where a line can be pinned into a rule or vetoed in one tap.
_Avoid_: blacklist (the never rule is one of the rules), filter, mapping (the CSV import's), auto-tagging (Tags stay orthogonal), training, learned category

### Recurring series
Rent, salary, Netflix as the Ledger App *reads* them (ADR 0034) — never as something typed in. One payee (the bank's casing, punctuation and row digits normalized away) whose Transactions keep a **cadence** — weekly, fortnightly, monthly, yearly — for near enough one amount: three occurrences and a rhythm make a series, and the run is read back from the newest Transaction, so a series is always what is still happening. Derived on every read, stored nowhere; a series with nothing for two whole periods is **dormant** — the bill is over and it asks no more. The only things a reading cannot decide are stored, as an internal **Series override**: **muted** ("don't forecast me" — the series is still read, still counts as fixed spending in reports, but raises no Dues) and the due days waved off. Deriving means there is no second truth to drift: the amount shown is the ledger's own median, a suggestion and never a promise.
_Avoid_: recurring transaction (the retired stored definition), subscription (fine in prose), scheduled transaction, template (the Calendar Apps' word), auto-payment, standing order, rule (a Categorize rule is a different thing)

### Due
One pending occurrence of a Recurring series: the day it is next expected and the series' suggested amount — a reading, never a write. A Due is watched until the bank statement brings the real Transaction (the arriving import makes it vanish by itself), or **skipped**: that one date waved off by hand. Projected one step past the series' newest occurrence, so a day already paid is never due. The list of upcoming Dues *is* the forecast; no separate concept. Lives in the Ledger App and its Dues Card — never on the time Surfaces.
_Avoid_: reminder, occurrence (a Task's), bill (fine in prose), pending transaction, confirm (retired — nothing ever posts from a Due)

### Pocket
The month-in-hand App: Allowances and Spends, a rough running tally kept by hand between bank statements, deliberately apart from the Ledger. The Ledger holds bank facts; Pocket holds what the user believes they have left. Nothing in Pocket is ever a Transaction.
_Avoid_: envelopes (ADR 0033 rejected envelope budgeting), budget (the Ledger's lens), pool (the Tasks App's unassigned chip)

### Allowance
A named sum the user grants themself for one **period** — "Eating out · September 2026 · €300" — owned by the Pocket App. The period is a calendar week (Monday-first), a calendar month, a calendar year, or a **custom** span of days ("Vacation · 12–20 Sept"). An Allowance is bound to its period: **renewing** one makes a fresh Allowance for the next week, month or year with the same name and amount and no Spends (a custom span is not renewed — it does not recur). An Allowance may wear a **face** — an optional emoji and an optional colour — so it is told apart at a glance; renewal keeps the face along with the name and amount. Nothing carries over — no rollover, ever; sinking funds are the Ledger's accumulating Category. What is **left** is derived: the granted amount minus its Spends, never stored.
_Avoid_: pool, envelope, pot (an accumulating Category's balance), target (Ledger policy), budget, recurring (a Ledger series), template, icon (a Lucide glyph is a type's mark, not a face), avatar

### Spend
One hand-typed amount taken from an Allowance on a day, with an optional label — an internal Document owned by the Pocket App, reported on the Daylog ("€12 · Eating out · lunch"). A belief, not a fact — the bank's Transaction, when imported into the Ledger, is the fact.
_Avoid_: withdrawal (implies an Account), transaction (a Ledger fact), expense (a Transaction kind), entry (a Stat's)

### Media item
_Retired_ — the one Media App split into four family Apps (ADR 0024): **Library** (books, comics), **Cinema** (movies, series), **Discotheque** (albums), **Arcade** (games), plus **Quotes** (born as the Commonplace book) for Quotes. A work is simply a Document of its type — book, comic, movie, series, music, game — owned by its family App; the type ids never changed. Works are still not editions, and still carry creator, year, size, cover by URL and an optional **Reason** (who sent me here — never asked at add). The old "Studied" mark is gone.
_Avoid_: media (as a type id or an App — neither exists), title, copy, edition, studied

### Shelf
Where a work stands with me, in its family's own verbs: **To read / watch / listen / play** (not started), **In progress**, **Done**, **Dropped**. One shelf per work; every family App's Gallery is browsed by shelf. In the Cinema, the Discotheque and the Library, **Done** is one click from any shelf — a film watched, an album heard, a book read — and clicking again undoes it; Marks and the Review survive either way, and in the Library finishing frees the Nightstand Slot, which undoing never takes back (re-slotting is deliberate).
_Avoid_: status (too generic), backlog, engagement (the internal field name)

### Gallery
A family App's main screen and the view you land on: the wall-to-wall cover grid of everything the App owns, narrowed by Shelf, search and — where the App owns two types (Books|Comics, Movies|Series) — a medium chip. Landing is always on All, never pre-filtered.
_Avoid_: library (an App), grid (a rendering), backlog

### Nightstand
Library only, for books and comics: the small capped set of items currently claiming attention — in progress and next up. A Slot is held for the whole time an item is in progress and freed only by finishing or dropping. Caps are fixed in code (books 5, comics 3); no other family has slots. A Nightstand item that isn't owned yet is the instruction to buy it *now* — it heads the Shopping list. Lives in its own tab, never on the Gallery.
_Avoid_: queue, TBR, wishlist, priority

### Shopping list
Every Wanted work of a family that still has **Acquisition** — Library and Arcade only (streamed media are never owned, so Cinema and the Discotheque have no Acquisition at all): Nightstand ones first (next up — buy now), then the rest, oldest first. Marking one as acquired takes it off the list; in the Library, **Bought** is one click on the work itself — Wanted ⇄ Owned, clicking again un-buys — while Borrowed and Gone stay deliberate menu moves. The Shelf never moves the list: a book read but still Wanted stays on it. A Card per App, never furniture on the Gallery.
_Avoid_: wishlist (that word hides the buy-now head of the list), cart

### Marks
Cinema and Discotheque only: what I make of a work, beside where it stands on the Shelf. **Liked** (a heart, on or off) and a **Rating** (one to five whole stars; unrated is its own state, not zero stars). Each is one click on the Gallery tile or the detail; neither implies the other, neither moves the Shelf, and a Shelf move never touches them. Marks are facts about the work, not events: nothing lands in the Daylog, nothing feeds Life Level.
_Avoid_: score, favourite (say Liked), half-star, vote

### Review
Cinema and Discotheque only: my own words about a work — its Document body. One per work, written from the detail, and everything a body gives for free follows: opened as text with the fields as frontmatter, wikilinks, `#tags` counted, Backlinks. Not a Note (it belongs to the work), not a Clipping (my words), not a Quote (a passage is the work's words).
_Avoid_: comment, notes (a Note is a Document), diary entry (there is no diary — one Shelf, one Review per work)

### Playlist
Cinema and Discotheque only: a named, ordered selection of works I curate by hand — "Films for a rainy Sunday", "Albums of 2025" — with an optional blurb (its body) and optionally **ranked**, which shows the order as numbers. Membership belongs to the Playlist, never to the work: a work sits in any number of Playlists, a deleted work simply leaves them. Each App owns its own Playlists over its own works (movies and series together in one; albums in another) — no Playlist crosses families. Lives in its own tab beside the Gallery, like the Nightstand does. Not a View (a View filters; a Playlist is chosen and ordered by me), not a Tag (unordered, no blurb), not the Shelf (a Playlist says nothing about whether I've seen it).
_Avoid_: list (a Base word and a layout), collection (a Stat kind), watchlist (that is the To watch shelf), queue, exhibition (the Museum's word)

### Note
A body-first Document type owned by the Notes App: my own thinking about things. Links, tags and headings are derived from the body; its fields are its frontmatter. Daily notes are Notes.
_Avoid_: document (the general block), page, file, clipping, writing

### Clipping
A body-first Document type owned by the Clipper App: text I pasted from outside, carrying its source (URL or name, captured-at) beside the body. Lifeline never fetches it — I bring the text, the Clipper keeps it with its origin. Not my words. A Quote is *not* a Clipping — it belongs to its Media item.
_Avoid_: note, bookmark, highlight, web clip (fine in prose, not as the term)

### Reference
Not a type: the informal name for any Document about a real-world thing (a person, a place, an organisation, a work) that other Documents link to. Person and place are user-defined types; works (books, films, albums, games) are References owned by their family App, Artworks by the Museum App. What makes something a Reference is being Linkable, not its type.
_Avoid_: entity, contact, using "Reference" as a Document type name

### Writing
A body-first Document type owned by the Writer's pad App: prose that is purely my own and *is* the thing (essay, story, draft), rather than notes *about* something. A Writing may have Versions.
_Avoid_: note, draft (a state a Writing may be in), article

### Version
An internal Document type owned by the Writer's pad: a snapshot of a Writing's body taken on purpose by pressing a button — never automatic. Versions are kept side by side with the current text for comparison; restoring one is a new edit, not a rewind.
_Avoid_: revision, history (implies automatic), backup (fine in prose)

### Note type
_Retired_ — use **Document type**. (Was: a kind of Note fixing its title rule, Properties and template.)

### Field
A typed value a Document type declares (mood, aliases, birthday, geo, employer…), edited as a form, shown as a Base column, and read/written as frontmatter when the Document is opened as text. Kinds: text, long text, number, boolean, date, datetime, select, multi-select, url, geo, list of text, and **Link**. No formulas — a computed value belongs to a View, not a type.
_Avoid_: property (old Notes word — same thing), metadata, attribute, column (a View's rendering of a Field)

### Link (field)
A Field holding a reference to another Document, optionally restricted to one type (`employer → organisation`). Stored by id, written as a wikilink in frontmatter, clickable in Bases, and a source of Backlinks exactly like a wikilink in a body.
_Avoid_: relation, foreign key, reference

### Note template
A Note whose body is the starting text for other Notes — the daily template, a meeting template. Lives in the `Templates` Folder; copied into a new Note's body once and forgotten, never a link. Owned by the Notes App. Not an Event template (that shapes an Event, not a body).
_Avoid_: template (bare — say which), preset, skeleton

### Daily note
The Note whose title is a date — at most one per day; the Journal entry. Created from the daily Note template on first use; the day's hub, carrying a Daylog block.
_Avoid_: journal entry (same thing — use "daily note"), log, diary page

### Journal
The Notes App's date-navigated Surface over daily notes.

### Wikilink
`[[Name]]` in any Document's body. Resolves by name — case- and accent-insensitive, spaces collapsed — across every Linkable Document type — exact title first, then alias — with an optional type prefix (`[[media:Dune]]`) to disambiguate; once resolved, the link remembers its target so later collisions don't move it. Unresolved links stay unresolved (click to create a Note). The editor's completer shows the type of each candidate.
_Avoid_: reference, mention (a mention is what the *target* sees)

### Backlink
From the target's side: a Document that wikilinks to it. Every Linkable Document has backlinks ("mentioned in").
_Avoid_: incoming link, reference

### Unlinked mention
A Linkable Document's title or alias appearing as plain prose in another Document's body, with no wikilink around it. Derived, never stored; offered from both ends in the links panel — the target sees who mentions it, the source sees which names it could link — and turned into a Wikilink only on request, never silently. A Document type may opt its Documents out as targets (daily notes, the Bible's scripture types with their own references). Not a Backlink (that needs a link).
_Avoid_: unlinked reference (the Bible App's scripture-specific kind), suggestion, candidate

### Linkable
Core Contract: a Document type whose Documents are wikilink targets by title and alias, and receive backlinks. Declarable by data (a user-defined type just says so).

### Graph
The Core Surface drawing every Linkable Document as a node and every link relation — wikilink or Link field, merged per pair, undirected — as an edge, coloured by owning App like Pins. Unresolved names appear as Ghost nodes; Documents nothing links to (orphans) are hidden unless asked for; Tags may be shown as nodes on request. The layout is derived, never synced.
_Avoid_: graph view (Obsidian's name), network, mind map

### Local graph
The depth-limited neighbourhood of one Document — its links, backlinks and Ghost nodes, drawn like the Graph. Shown as a panel on the open Document and placeable on a Screen as the **Graph card** (a configurable generic Card: Document + depth). A Screen's Tag filter treats a Graph card as one unit; it never filters nodes inside the neighbourhood.
_Avoid_: connections panel, related items

### Ghost node
An unresolved wikilink name drawn on a Graph: a hole in the vault. Clicking it creates the Note, exactly like clicking the unresolved link itself.
_Avoid_: phantom, placeholder, unresolved node (fine in prose)

### Locatable
Core Contract: a Document type whose Documents sit at a geographic point, so any map Surface can draw them. Declarable by data (a user-defined type with a geo field). Coordinates are the owning App's data (resolved when the entity is edited, never looked up at render time); an entity with an address but no coordinates is not Locatable yet.
_Avoid_: mappable, geolocated, placed (Placement is a calendar concept)

### Pin
One Locatable entity drawn on a map: name, optional subtitle, coordinates, and a way to open the entity. Coloured by owning App. Not stored — read live from the Apps.
_Avoid_: marker (a rendering detail), place (a Note type), location (that's the coordinates, not the entity)

### Daylog
Core Contract (behaviour — code only): an App reports what *happened* on a day — completed tasks, chore completions, logged entries, media started/finished, events. Rendered live wherever a Daylog block appears (a daily note's fenced `daylog` block, or a Card); never written as text.
_Avoid_: timeline, activity feed, summary

### Tag
A free-form, lower-cased word (`garden`, `health/gym`) a user puts on any Document to group and filter across types. Same word, same tag, whatever App it sits on; the vocabulary is derived from use, never managed. Recurring things carry tags on the definition; Occurrences, Entries and Placements inherit their parent's tags. A bodied Document's tags include `#garden` words found in its body. Time blocker bands are the one thing a Tag filter never hides.
_Avoid_: label, category, folder (a Folder is where a Note lives), Note type

### Tag filter
A set of Tags that narrows what a Card instance or a whole Screen shows: an item passes if it carries *any* of them. A Screen's filter applies to every Card on it; a Card's own filter narrows further within that (both must pass). Empty filter = show everything. Untagged items never pass a non-empty filter.
_Avoid_: view, saved search, override (nothing overrides — filters compose)

### Taggable
_Retired_ — every Document carries Tags by construction; Core derives the vocabulary from the store. Contract items placed on Surfaces (Schedulable, Timed, Daylog, Pin…) still carry their Document's Tags, so Tag filters apply everywhere.

### Source
Something outside Lifeline shown inside it, owned by the Sources App. Kinds are added over time; the first is the Embed. A Source is named, tagged and pickable for a Card; Lifeline never owns the data behind it.
_Avoid_: integration (that is an App talking to a service), widget, feed (one future kind)

### Embed
A Source kind: a web page shown as-is in a frame, by URL. Lifeline displays it and does not understand it; a page that refuses to be framed stays blank and can only be opened outside. Optionally reloads itself on a period.
_Avoid_: iframe (a rendering detail), link (that's a Wikilink), bookmark

### Feed
A Source kind: an RSS/Atom URL Lifeline reads and lists — latest items, opened outside. Remembers only "seen up to when"; never the items themselves.
_Avoid_: reader, subscription (that's a Calendar subscription), channel

### Calendar subscription
A Source kind: an iCal URL whose events appear on the time Surfaces as read-only Timed items in the subscription's colour. They are never copied into the Calendar App's Events and can't be moved or completed.
_Avoid_: external calendar, imported calendar (nothing is imported), feed

### Live value
A Source kind: a URL polled on a period, from whose response one value is read (a JSON path or a regex capture) and shown as a tile with a label and unit. Shows when it was last read; goes stale, never fakes.
_Avoid_: metric, sensor, stat (a Stat is owned data with history — a Live value has none)

### Conflict copy
A sibling Note "<title> (conflict HH:MM)" saved when sync would have overwritten unsynced local edits. Nothing is merged, nothing is lost.

### Workspace
A full-screen environment over the same data, chosen by URL: the **Vault** (Obsidian-shaped: tree, editor, links — over every Document that has a body, whatever its type) and the **Dashboard** (Screens, Surfaces, App screens, Bases). Core owns the switcher; an App declares which Workspace its screens live in. Two views of one dataset, not two apps.
_Avoid_: mode, full-screen app, view, "Notes workspace" (old name of the Vault)

### Attachment
A file — for now an image — dropped or pasted into a Document's body and kept by Core beside the content: bytes, filename and kind, nothing else. Not a Document: no type, no Base, no Folder, no Tags, absent from the Vault tree; it exists only to be embedded from bodies by name, and any body-first type (Note, Clipping, Writing) may embed one. Renaming it rewrites every embed, as renaming a Note does. Deleting the embed never deletes the Attachment: one no body embeds any more is **orphaned**, kept, and removed only when the user asks to clean up.
_Avoid_: image (the kind, not the thing), file (a storage detail), asset, upload, media (the retired App)

### Vault
The Workspace with Obsidian's chrome. Shows any Document as frontmatter + body in a generic editor; the Note taker, Clipper and Writer's pad Apps put their specialised editors here. Not a storage place — Documents live in one store whatever Workspace shows them.
_Avoid_: notes (one type), library, folder

### Folder
Where a Document lives: a `/`-separated path (root when empty). Every Document has one; only the Vault tree cares. A Folder exists because Documents are in it; titles are unique within a Folder for a given type. Daily notes live in `Journal/YYYY/MM`, templates in `Templates`, private notes in `Private`.
_Avoid_: directory, category (that's a Document type), tag

### Private folder
The one reserved Folder, `Private` at the root (subfolders included), whose Documents are shown only while it is **unlocked**. It exists once the user has **set it up** — chosen its password — and adopts any plain `Private` folder already there. Only body-first Documents (Note, Clipping, Writing) may be created or moved into it; no Task, Event or other App Document ever hides there. A gate, not a safe: it keeps eyes off, not bytes secret — the text is stored like any other Document's. Same password on every device, usable offline; resetting it needs the account password and loses nothing.
_Avoid_: vault (the Workspace), encrypted/secret notes (they are not), locked folder (say "the Private folder is locked"), hidden folder

### Locked / Unlocked
The state of the Private folder on this device, right now. **Locked** (the default — after a reload, after idle, after the app goes to the background, on a device that has not yet learnt the password) means its Documents are absent from everything: tree, search, links and backlinks, unlinked mentions, Graph, Bases, Cards, autocomplete, tag vocabulary. The folder itself still shows, closed; a link into it shows as locked and asks for the password rather than pretending the target does not exist. **Unlocked** means they behave like any other Document until the user locks again or the timeout does. Anything that must see every body — Attachment clean-up — refuses to run while locked rather than peeking.
_Avoid_: hidden (locked Documents are absent, not hidden in place), logged in / signed out (that's the account), open / closed (a Folder node in the tree)

### Commonplace book
_Retired_ — the App is now called **Quotes**; its id and ADR 0024 keep the old name.

### Bible study
The Bible App: a lens over the study, not a second notebook. It owns the *references* of Bible study — Verses, Characters, Concepts — and scopes the material to them: the Notes (on verses, articles, speeches), Clippings (pasted articles) and Writings (talks) that link to a Verse, Character or Concept are *the* Bible study, wherever they live; the App lists them, draws their Graph, and reads verse references in any body. No Bible Note, no Bible Clipping, no Bible Writing: a Note is my thinking about things, whatever the thing.
_Avoid_: Bible notes app, study notes (a type), scripture app

### Verse
One verse of scripture as a Linkable reference, owned by the Bible App — "John 3:16" and nothing else: no text is stored, a Verse is a hub that Notes and ideas connect through, the Bible itself stays on the shelf. Written as `[[John 3:16]]` in any body; a **range** written once — `[[John 3:16–18]]` — is one link in the text that resolves to every Verse in it. A bare reference in prose ("see Rom 8:28") is found and *offered* as a link, never linked behind your back. A Verse belongs to its Chapter, a Chapter to its Book; all three are created on first mention, never seeded.
_Avoid_: scripture (the whole), passage (a range — fine in prose), reference (the informal word for any Linkable thing), citation

### Chapter
A chapter of a Book as its own Linkable Document, owned by the Bible App — "John 3" — that its Verses belong to, so a Note on the chapter and the Notes on its verses find each other. Has a body: the place for what the chapter as a whole is about.
_Avoid_: section, pericope

### Book
A book of the Bible as its own Linkable Document, owned by the Bible App — "John", "Romans" — that its Chapters belong to. Has a body. The canon's names and their abbreviations are the App's, so `Jn`, `Rom`, `1 Cor` resolve.
_Avoid_: book (a Library work — say "Bible book" when both are near), volume

### Character
A person of the Bible, owned by the Bible App and Linkable: Paul, Ruth, Pilate. Distinct from a user-defined `person` (someone I know) — a Character is met in the text, and a Note or Verse links to it.
_Avoid_: person (my own contacts), figure, biblical person (fine in prose)

### Concept
An idea the study keeps returning to — grace, covenant, exile — owned by the Bible App and Linkable, so Notes, Verses and Characters gather under it. A Concept is a study's own vocabulary, not a Tag: it has a body of its own and can be written about.
_Avoid_: theme (fine in prose), topic, tag, context (the setting; also a word Lifeline already uses for its glossary)

### Talk
Not a type: a Writing I give aloud — a sermon, a study-group talk. Marked by its Writer's pad project ("Talks") or a `talk` Tag, it links the Verses, Characters and Concepts it draws on like any body and keeps Versions like any Writing. The Bible App lists such Writings under "Talks"; the day it is given is an Event, since a talk is given more than once.
_Avoid_: sermon (fine in prose), speech (that's something I *heard* — a Note or Clipping about it), presentation

### Quote
A passage kept from a work of any family — its text, an optional locator (page, chapter, timestamp), an optional comment and tags — owned by the **Quotes** App (ADR 0024) and impossible without the work it links to, whatever App owns that work. Inserted into notes as a blockquote ending in a wikilink to the item; also a wikilink target by its opening words. Captured on a day, it is a Daylog fact ("Quoted").
_Avoid_: highlight (a quote may be a thought you had about it, not only the text), excerpt, clipping

### Pantry
The stocks App: what food the household holds and where. Owns Provisions and Storages; tracks presence and quantity, not recipes or meal plans.
_Avoid_: inventory (fine in prose), larder, stock app

### Provision
A food product held in stock — one Document per product per Storage: a quantity (a count of units), an optional unit label ("500g pack"), an optional Minimum, and two optional dates: **expires** (a check-by hint — the earliest unit you own, not a guarantee) and **frozen on**. Quantity 0 keeps the Provision: a catalog entry that is out of stock, not a record to delete.
_Avoid_: product, item (Media item is taken), ingredient (recipe-speak), stock (the aggregate), grocery

### Storage
A place food lives, user-defined and owned by Pantry — "Chest freezer", "Spice rack" — of exactly one kind: freezer, fridge or shelf. A Provision sits in exactly one Storage; the same product in two places is two Provisions.
_Avoid_: location (Locatable's word), place, zone, pantry as a kind (the App's name — say shelf)

### Minimum
The optional threshold on a Provision below which it is **running low**: quantity under the Minimum, or zero even without one. Running low is a reading over Provisions, not a list you edit.
_Avoid_: shopping list (Library's books), reorder point, restock threshold

### Prices
The price App: what regular purchases cost, where, and over time. Owns Products, Shops and Receipts; holds no link to the Ledger (bank facts) or to Pantry (stock), and every history, comparison and change figure is derived from Lines, never stored.
_Avoid_: price tracker (fine in prose), receipts app (the capture unit, not the reading), grocery app

### Product
A thing bought again, owned by Prices, Linkable: a name and a fixed **measure** — kilogram, litre or piece — that every Line of it is expressed in. Pack size is *not* part of a Product: a litre and a six-pack of litres are one Product with different amounts on the Line. Remembers the printed **labels** a Shop uses for it, so the next import of that label resolves on its own. Never deleted while Lines reference it — **merged** into another Product of the same measure instead, Lines and labels carried over.
_Avoid_: item (Media item is taken), article, SKU, Provision (Pantry's stock row), grocery

### Shop
A chain where things are bought — "Lidl", "Biocoop" — user-defined, owned by Prices, Linkable. A Shop is the chain, never the branch: prices are compared per chain, and a branch is at most a free-text note on the Receipt. Deleting a Shop that Receipts reference is blocked.
_Avoid_: store (say shop), Storage (Pantry's place food lives), merchant, payee (the Ledger's word), branch (a note, not a Document)

### Receipt
One buying occasion at one Shop on one day, owned by Prices: the Shop, the day, an optional branch note, the printed **total** as read (kept beside the derived sum of its Lines, a mismatch shown as a warning and never blocking), and its Lines. May hold the photo it was read from, embedded in its optional body as an Attachment. A price noticed without buying is a one-Line Receipt with no printed total. Reports to the Daylog ("€54.20 · Lidl"). Deleting a Receipt deletes its Lines.
_Avoid_: purchase, shopping trip (fine in prose), bill, invoice, ticket, transaction (the Ledger's fact)

### Line
One priced entry on a Receipt — internal to it: the printed label, an **amount** in the Product's measure (6 L, 0.42 kg, 12 pieces), the **price paid** in cents after any discount, and a **promo** flag. **Matched** to exactly one Product or **unmatched**, in which case it is shown loudly as an inbox to clear, never hidden and never dropped. The only fact price history is made of.
_Avoid_: item, observation, entry (a Stat's), split, line item (say Line)

### Unit price
The derived number every reading of Prices uses: a Line's price paid divided by its amount, so €/kg, €/L or €/piece. Never stored. "Usual price" readings and the change figure exclude promo Lines; history plots them, marked apart.
_Avoid_: price (ambiguous — a Line's is the price paid), rate, normalised price

### Price change
The derived reading of how a Product's unit price moved over a span, always **per Shop**: earliest to latest non-promo unit price at that Shop inside the span. The all-Products figure is the median of the per-Shop changes over Products with at least two points at that Shop in the span. No cross-Shop number exists — a switch of Shop is not inflation.
_Avoid_: inflation (fine in prose), trend, index
