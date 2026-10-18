# Lifeline — Context

Glossary of domain terms for Lifeline, the personal dashboard/OS. Implementation details live elsewhere.

One shell, one Document store. Hand-written Apps own built-in Document types and their behaviour; user-defined types get Core's generic behaviour; everything is shown through Cards, Screens, Surfaces, App screens and Bases, and interoperates only through Contracts defined by the Core.

## Glossary

### Document
The one basic block everything in Lifeline is made of. Every record a user can see — Task, Chore, Event, Stat, Entry, Media item, Quote, Source, Note… — is a Document of exactly one **Document type**. Every Document has a title (free, dated, or **derived** read-only from its fields as the type decides), typed fields, Tags, a Folder (root by default), and — where its type allows (required / optional / none) — a markdown body; the fields double as that body's frontmatter properties. Contracts (Schedulable, Linkable, Locatable…) apply to Document types; Cards, Screens, Surfaces, Bases and Apps all present or process Documents and never anything else.
_Avoid_: record, entity, item, page, file, note (one type), block (a body fragment)

### Document type
The kind of a Document: its field schema, title rule, body policy and the Contracts it implements. Adding a type is meant to be cheap and automatically yields a Base. A type may be **internal**: its Documents exist only in service of another Document (an Essay's Versions) and are hidden from the Vault tree, link completion and the sidebar, and are neither a target nor a *source* of link relations — their wikilinks, Link fields and Tags belong to the Document they serve, so they raise no backlink, Ghost, tag entry or Unlinked mention of their own — though they still have a Base. Two origins, one registry: **built-in** types are defined in code and are the only ones an App's behaviour may depend on; **user-defined** types are created in-app and get everything generic (Base, form, body, generic Cards) plus the Contracts that can be declared from data alone — a Contract with behaviour hooks needs code. A type is shared by every Workspace — only its Documents are separated. A user-defined type can be deleted only once no Document of it is left, in any Workspace — a Document never loses its type. Subsumes the old "Note type".
_Avoid_: schema, collection (storage detail), category, template (a part of a type)


### App
A hand-written domain module (Chores, Stats, Media, Tasks…) living inside the shell. Owns one or more built-in Document types: it alone defines their behaviour — Contract hooks, commands, rules, and which fields are **guarded** (editable only through the App's own operations — never by a Base's raw write, and read-only when the Document is opened as text). Any App or generic tool may *read* any Document; semantic operations go through the owner. Apps are never generated per type; user-defined types have no owning App and are served by Core's generic behaviour.
_Avoid_: plugin, widget, service, processor

### Core
The neutral part of the system: shell, Contracts, sync layer, command registry, the Document store and type registry, Bases, Surfaces and generic Cards. Owns no Document types; its own bookkeeping — Screens and Card instances, Placements, Views, user-defined type definitions — is synced but is *not* Documents (Documents are user-facing content only). Of it, only **Screens** belong to a Workspace; Views and user-defined types are global (a View belongs to its Base, which follows the Module, and a type defined twice to be used in two Workspaces would be a bug), and Placements and Attachments follow the Document they serve.

### Account
One sign-in, owning its own Documents and Core bookkeeping (Screens, Placements, Views, user-defined types, Attachments) outright. Nothing is shared or visible across Accounts; the server, never the client, decides which Account a record belongs to. One device holds one Account's data at a time.
_Avoid_: user (the human), tenant, workspace (a container inside one Account), profile

### Contract
An interface defined by Core that a Document type implements (Schedulable, Timed, Loggable, Linkable, Locatable, Taggable, Daylog…). Carries data shape *and* behaviour hooks — the consuming Surface calls the hook; the owning App decides what happens. Built-in types implement Contracts in code; user-defined types may declare the data-only ones (e.g. Locatable through a geo field). The five things that serve Documents — Card, Screen, Surface, App, Base — are *not* Contracts and have no collective name.
_Avoid_: capability, trait, API, decorator

### Schedulable
The first Contract: an entity that can be placed onto a time surface (the Calendar). The owning App supplies title/identity/status and behavior hooks — e.g. what completing a placement means, and what happens when a placement's time passes uncompleted (keep / roll forward / drop). A Chore rolls its placement forward until completed; a simple task's placement just passes. The App may also report an item's **Estimate**, which is what earns the item a **Push**.

### Timed
The second Contract: an entity that happens at a fixed time on a day (start/end, or all day) and is not work — nothing to complete. Surfaces draw Timed items above the day's Schedulable work. The Calendar App's Events are the first implementation; the owning App may allow moving them to another day, may offer Event templates for quick add, and may report background items — Time blocker bands, which hour-scaled Surfaces paint behind everything and day-granular ones leave out. It may also report **markers** — a day that matters with nothing happening on it, a Project's Deadline — which are all day, take no hours, and are drawn as a flag rather than an Event.
_Avoid_: appointment (that's an Event, one implementation), block

### Loggable
A Contract: an entity that accepts a logged occurrence from any other App — a Stat takes an Entry (a value at a moment), a Habit takes a Completion (a moment, a note). The owning App lists its targets and does the logging; the sending App only names the target and the moment. How Workout Sessions feed Habits and Stats; open to Chores and Tasks later.
_Avoid_: trackable, sink, hook (the Contract's own word for its functions)

### Intake
Core Contract (behaviour — code only): an App that accepts a Handoff from any other App and makes one of its own Documents from it, through its own form. The accepting App declares what it makes ("Quote", "Task", "Event") and opens its dialog prefilled with the Handoff; nothing is written until that dialog saves, so ownership stays whole. The sending App only lists the Intakes Core knows and never names a keeper. The Notes App (a Quote), Tasks, Calendar, the Shopping list (a Need) and Knowledge (a Word, a Sentence or a Fact — three Intakes, the user picks) are the implementers; how Mail keeps a Message.
_Avoid_: clip (one implementer's verb), import, share (the phone OS's word), capture (a Command's flag)

### Handoff
What one App hands to another's Intake: a title, a text in markdown, an origin URL, an author, a date and, when it came from one, the **origin Document** — and nothing the sending App would have to know about the receiver. Made by any App, or by **selecting text** in any Document's body or passage — a Note, a Quote, a Thought, an Essay, a Day — which offers every Intake Core knows, with the Document read from as its origin. A Mail Message, which is no Document, is handed off whole. Each Intake reads it its own way: the Notes App keeps the text as the Quote's passage and asks for its Source, Tasks takes the title and puts the origin in the note, Calendar takes the title and asks for the time.
_Avoid_: payload, message (a Mail thing), draft

### Tally
A standing instruction on a Document to log each of its **occurrences** somewhere Loggable — a Workout "tallies to Habit *Train*" (each Session), a Topic "tallies to Habit *Spanish*" (each day practised). Carries the target and what value to send (one, the duration, a Block's result). Core's, through the Tallying Contract, and kept on the Document it sits on, so it follows it wherever it goes. Fires once per occurrence, when the occurrence happens, and never again — never retracted either: what it logged is the receiving App's Document, with that App's own undo. Never backfilled: a Tally set up today logs nothing for yesterday.
_Avoid_: feed (a Source kind), sync, bridge (the idea, not the thing), hook

### Tallying
Core Contract (behaviour — code only), the sending side of Loggable: a Document type whose Documents may carry Tallies. The owning App declares what an occurrence is and which values it offers, and reports each one as it happens — Workout a saved Session (one, duration), Knowledge a Topic's first Recall of the day (one). Core keeps the Tallies, offers the one "tallies to…" editor over every Loggable target, fires them, and makes sure one occurrence logs once.
_Avoid_: Loggable (the receiving side), trigger, automation, rule (a Categorize rule's word)

### Recallable
Core Contract (behaviour — code only): a Document type whose Documents yield **Prompts** to be kept from being forgotten. The owning App declares which Prompts a Document yields, what each one is known by, and how its question and answer are shown; it never schedules, grades or keeps anything about practice. The **Knowledge** App is the one consumer: it owns every Recall and every Practice over all Recallable types, as Stats and Life Level own what is logged to them. Any App may make its types Recallable without the Knowledge App knowing them by name. Deleting a Recallable Document, whatever App owns it, takes its practice with it: Core tells the practising App, which strikes the Recalls.
_Avoid_: quizzable, flashcard-able, reviewable (Review is Cinema's body), study

### Placement
A Schedulable entity's assignment to a day — and optionally a time slot — on a surface. Owned by the surface (Core), referencing the foreign entity by App + id; the time is the surface's, never the App's (a Task still only knows its day). An entity may have any number of Placements — several Time blocks across several days — and none of them moves the entity's own day. Distinct from the entity itself: deleting a Placement never deletes the entity. Subsumes calendar's old "TimeBlock".
_Avoid_: TimeBlock, occurrence, booking

### Time block
A Placement that carries a start (and end) time: one planned stretch of an item in the Schedule's hours. An item may have as many Time blocks as it needs — a long Task split over Monday and Wednesday — on any days, without its own day changing; a block is planning, never the item. A block has no done state of its own: its tick is the item's tick and completes the item, which then drops every block still ahead (starting after the moment of completion) and keeps the past ones as record. Blocks show where hours show — the Schedule, the Agenda card — and in the Today feed and Upcoming as that day's work; Month shows the item on its own day only. Dragged off the hours, a block is simply gone — into the pool, the item keeps its day; into a day's strip, the item takes that day. When the item rolls forward as overdue, the time is dropped. Blocks never repeat on their own.
_Avoid_: appointment, event (that's the Calendar App's timed thing), slot (the empty grid cell), session / instance / occurrence (of a block — say "a Task's Time blocks")

### Push
One tap that finds an item time in the Schedule's hours, owned by Core and offered on any Schedulable item whose App reports an **Estimate** — the Tasks App first. With no block ahead, Push makes one Time block of the Estimate's length in the first **free** stretch; with one ahead, it pushes the earliest such block, at its own length, to the first free stretch after it — from its end if it has not begun, from now if it has — so Push only ever moves later and never nudges a block into its own old time. Free means covered by no timed Event, no other Time block and no Time blocker, weekly or one-off; all-day Events and switched-off blockers take no hours. The stretch is one piece, on the Schedule's quarter-hour grid, searched from now — or from the item's own day when that is still ahead — and up to two weeks out; it may fall after the item's day, which never moves. Nothing free, nothing written. An item with no Estimate asks for one first and keeps it. Undoable; never offered on a done or archived item.
_Avoid_: reschedule, auto-schedule, snooze, defer, Move (that changes the day), find time

### Calendar
The one Surface for time, the way Google's calendar is one place: a single destination whose **views** — **Upcoming · Day · 3 Day · Week · Month** — are switched in place. Day, 3 Day and Week are hour-scaled and together are the **Schedule**; Month and Upcoming are day-granular, show each item on its own day only, and leave Time blocker bands out. The Unplaced pool is a drawer the Calendar offers in every view. Every view shows the one **day in view**: switching view keeps it (Week shows its week, Month its month, Upcoming starts from it), and 3 Day starts on it rather than on a week boundary. Month takes Moves by drag, the pool's included; Upcoming only reads and ticks. Embedded in a Module, the Calendar is a lens: scoped to that Module's types, offering only the views the Module picks (House: Month and Upcoming), and keeping its own day and view apart from the general one. Supersedes the separate month Calendar, Schedule and Week planner Surfaces. Not the **Calendar App**, which owns Events and has no destination of its own — say "the Calendar App" for that.
_Avoid_: calendar view (say which view), Week planner (retired: Week is hour-scaled), time Surface

### Schedule
The Calendar's hour-scaled views (Day view, 3 Day view, Week view — always said with "view", since a Day and a Week are Journal Documents), where Time blocks and Events are laid out and dragged, over the bands of the day's Time blockers, beside the Event templates offered for quick add. Its chips — the pool and each day's untimed strip — are sources: dragging one onto an hour makes a new Time block and leaves the chip in place, greyed while blocks lie ahead; dragging a block moves that block alone. Anything on the hours — a Time block, an Event, a one-off Time blocker — opens when tapped, wherever hours show, to be retimed by start and length, sent to another day, or removed. Changes take effect at once and are undone, never confirmed. A Time block is removed and its item stays; an Event or blocker is deleted by its App. A done item's block is record: it can be removed but not retimed. Tapping an empty hour of the Schedule adds there: an Event, from a template, or unplaced work. Distinct from the Calendar's day-granular views, Month and Upcoming.

### Upcoming
The Calendar's list view: it runs down the days from the one in view, each day a heading with what is on it beneath: all-day items and markers, then timed items in start order, then the day's work, tickable in place. Day-granular — it shows no hours, so Time blocker bands are left out. Each day reads the way the Today feed reads today: work blocked on that day is listed there at its block's time, pointing on to its own day, as well as on its own day; its tick is the item's. Empty days are skipped, today aside; a run of them reads as one "nothing on" line, so a free week is seen rather than lost. Past days are record. It is for reading what's coming, the phone's way of answering "what's next?". Distinct from the Schedule (hour-scaled) and Month.
_Avoid_: agenda (the Agenda card is hour-scaled), schedule (Google's name for this view, but Lifeline's Schedule is the hours), planning view, list (a Base layout)

### Base
The one bulk place for one Document type: every Document of that type, shown for sorting, filtering and bulk editing of plain fields (guarded fields go through the owning App). Exactly one per type, generated from the type — adding a type adds a Base. A Base holds **Views**. The Bases are the raw layer and look the same for every type: they live together in one top-level place of their own, beside the Modules and belonging to none — the only home a user-defined type's Documents have — and a Module may link down to its own types' Bases but never re-hosts them.
_Avoid_: table (one layout), database, list, explorer

### View
A named, saved configuration inside a Base: filters, sort, visible fields and a **layout** — table, list, cards, gallery, map, board or calendar. A layout that reads one particular field (gallery's image URL, map's geo, board's group-by select, calendar's date) stores that field pick in the View and is only offered when the type has such a field; Documents the layout cannot place (no coordinates, no date) are left out but counted, never silently swallowed. Layouts display — they never bypass ownership: a board drag on a guarded field is a request to the owning App, which runs its real operation or declines (no App answer → that board is read-only), and the calendar layout never moves anything (moving through time is Surface work). Every Base starts with an "All" View; the user adds more ("To read", "Open · work"). A View is the unit you place on a Screen as a Card, rendered in its own layout wherever it appears.
_Avoid_: saved search, filter (one part of a View), base (the container), view type (say layout)

### Surface
A fixed, hand-written page owned by Core that shows Documents of *many* types together through a Contract, never through a type directly (Calendar, map, Today feed, Journal). Surfaces are general; Apps are specific. A Surface exists in two places: **general** — a top-level destination beside the Modules, belonging to none of them, showing everything its Contract reaches, never less; and **embedded** in a Module, scoped to that Module's own types (House's calendar shows Chores, Money's shows Dues). The general one is the truth about Tuesday; an embedded one is openly a lens. Distinct from an App screen (one App's own page) and a Screen (user-composed).
_Avoid_: page, dashboard, view (that's a Base's saved configuration), screen

### App screen
A fixed, hand-written page an App ships over its own types (Gallery, Chores, a Stat's detail page). Listed in the sidebar beside Surfaces and Screens, under its App's Module.
_Avoid_: surface (Core-owned, cross-type), screen (user-composed), page

### Module
**The thing the user opens**: a hand-written product over a domain — Money, House, Projects, Culture, Journal, Notes, Research, Manuscript, Thoughts, Progress, Mail — with its own layout and navigation, written for that domain and no other. It composes what its Apps supply (App screens, Cards) and the Surfaces it embeds, and may mix them on one page: Money's home may put Pocket's Allowances beside the Ledger's Budget. The Apps inside it keep ownership of their types; the Module owns only the arrangement. So the user meets "Money", never Ledger, Pocket and Prices as three neighbours. **Whatever the user opens is a Module**: a Module of one App is fine (Mail), because the layout is still the Module's — and a Module of one screen wears no chrome of its own, since a sidebar holding one link is chrome for nothing. An App belongs to no Module only when it never needs a destination of its own — the Calendar App, whose Events live on the general time Surfaces and are managed from them. The **Vault** is no Module's layout: it is the raw editor for bodies, beside the Bases. Core owns the list, the titles and the order — fixed in code; an App names the one Module it belongs to and nothing else, and cannot invent one, and neither can the user. The user owns which Modules a **Workspace** takes: nobody needs a "Work" Module because a Work Workspace is the thing they wanted — work Tasks are still Tasks. A Module never gates a general Surface, the Bases, the command palette or a Screen's card picker; what it scopes is its own embedded Surfaces and every *list of things to run* — the phone's capture sheet shows the Workspace's Modules' capture Commands and no others. It never gates the *ability* to create: the palette reaches everything. **Modules scope chrome; Workspaces scope data.** Supersedes the Nav group, which was the same shelf when it held only screens and was explicitly not a container.
_Avoid_: Nav group (the retired name), App (one member — the part that owns types, not the thing the user opens), Frame (retired), category, folder, section, suite, plugin

### Module screen
_Retired_ — it was where a Module's slot landed: a Screen that claimed the Module, else a generated index of its App screens. A Module now ships its own layout, so where it lands is its own home page, written by hand.
_Avoid_: Screen (a Module screen may *be* one, and is otherwise generated), App screen (what the index lists), home, launcher, folder

### Overview
The page a Module lands on when that Module declares one: Card instances on a grid, which the user can rearrange. The Module writes the **default** arrangement by hand, so it never opens blank. The user may move, resize, add and remove Cards. Each **Workspace** has its own arrangement of a Module's Overview. An Overview nobody has edited follows the Module's default, including later changes to it. The first edit makes the arrangement the user's own, and from then on it never changes by itself until the user chooses **Reset to default**. An Overview is not a Screen: it is never named, created or deleted, and it is not listed among Screens. It exists exactly when its Module is in the Workspace. If the Module leaves the Workspace, the user's arrangement is kept and comes back when the Module returns. Deleting the Workspace deletes its Overviews' arrangements; unlike Screens, they are not moved to another Workspace. The user may empty an Overview completely; it is never *created* empty. Its Cards behave exactly as they would on a Screen, and the Module does not scope them. The card picker offers every Card and lists the Module's own Apps' Cards first. Only some Modules declare an Overview (Money, House, Culture, Progress). The Vault, Mail and the other Modules that land straight on one page have none. A Module may give its Overview its own label in its navigation ("Now", "Today"); it is still the Overview.
_Avoid_: home, home page, Module home (confused with Home Module), dashboard, Module screen (retired), Screen (an Overview belongs to its Module)

### Rail
Core's only chrome on the desk: a narrow column of icons at the far left — the Workspace switcher on top, then the Workspace's Modules, then the general Surfaces, then the Bases, Screens and Settings at the foot. Everything to its right is the open Module's, laid out as that Module wants. The Rail is how you go *between* places; it never shows what is *inside* one.
_Avoid_: sidebar (a Module may have one; the Rail is not it), dock, launcher, activity bar, nav

### Home Module
Where a Document opens when it is opened all the way: its type's owning App's Module — a Category in Money, a Chore in House. Every built-in type has exactly one; a user-defined type has the one Module the user homes it in, or none, and then opens in its Base; a type whose App has no Module (an Event) opens where it is shown. The body is the exception that holds everywhere: it is written in the Vault.
_Avoid_: home (the phone has none), owner (the App, not the Module), home Folder (where a new Document lands)

### Peek
The owning App's small view of one Document, opened **where the user is** — over the Vault, a general Surface, another Module — with its fields and main operations, and a way through to its Home Module. How a link, a backlink, a search result or a Surface chip opens by default: interconnection should not throw the user out of what they were doing. Ownership is whole, because the Peek is the owner's.
_Avoid_: preview (read-only; a Peek operates), popup, modal, quick view, hover card

### Command
A named action an App registers with Core, run from the global palette (Ctrl+K): navigation or domain action ("Complete chore…", "Log entry…"). Declares an argument signature from day one; v1 collects args via dialog, inline parsing may come later. A Command may be flagged **capture** — it leaves one new record in seconds, without going anywhere: either something new from the user's head (a Task, a Need, a spend, a clip) or an occurrence against a thing that already exists (a Habit completed, a film watched — picking the thing is part of writing the record). Starting something live is not capture, however often it is done from the phone: a workout runs for half an hour and records nothing in seconds. Capture Commands are what the phone's "+" sheet lists. A Command may be **headless**: it also declares its arguments fully enough to run without its dialog. An agent or any other caller can then run it by passing those arguments, and it records exactly what the dialog would. **Every capture Command is headless**, unless capturing needs the device itself (a photo of a receipt). Other Commands are headless only when there is a reason. A headless Command never overwrites: adding a *thing* that already exists (a Need, a Word, a day's mood) is refused and reported, while *records* (entries, fines, spends) never collide.
_Avoid_: shortcut, action; API command, tool (the agent's word for a headless Command)

### Screen
A user-created, named page composed of Cards on a grid layout (drag/resize). Users create any number. Every Screen **belongs to the Workspace it was made in** — always, whether or not that Workspace is separated — so a Workspace has its own dashboard and its own arrangement of Cards; Screens are the **side door**, not the main interface: one Core destination beside the Bases, for the occasional page across Modules the user arranges themself (a morning overview). The hand-written Module is the interface; a Screen never claims a Module and is never where the app opens.
_Avoid_: page, view, workspace (a Screen is *in* one, not one)

### Card
A self-contained UI block for use on Screens and Overviews — small ("chores due today", "current streak") or large (full calendar grid). The unit of layout composition. A Card is a *kind*; what sits on a Screen is a Card instance. Two origins: **App Cards**, hand-written and registered by an App; and Core's **generic Cards** that work on any Document type — the **View card** (a Base View on a Screen), the **Document card** (one chosen Document, fields and body) and the **Count tile** (how many Documents a View holds). Capture/quick-add is always an App Card. Some Cards are **configurable**: they can't be shown without the user choosing something first (which Stat, which View, which Document).
_Avoid_: widget, block, tile (except Count tile), embed

### Card instance
One placed copy of a Card on one Screen or one Overview, with its position and, for configurable Cards, its chosen settings. It may carry its own title (Pocket's Allowances placed as "What's left"). The same Card may be placed many times on a Screen with different settings (a "Push-ups" tile next to a "Weight" tile). Removing an instance never touches the entity it points at.
_Avoid_: widget, tile

### Phone home
_Retired_ — the phone has no Home. It was the one Screen a **Phone bar** slot opened, designated per Workspace, and it never became what it claimed: the app's own root sent the phone to the first Screen and never once consulted the flag. With the slot gone there was nothing left reading it, so the designation goes with it and a Screen reaches the bar the way any destination does — by being put in a slot. What the term stood for survives without a name: on a phone Lifeline is capture-and-consult, a Screen's Cards stack in one column, and a Screen is composed on the phone as well as at the desk.
_Avoid_: mobile app (it is the same app), home screen (the OS thing), Home (there is no such slot; say the Screen)

### Phone bar
The phone's **Rail**: the five slots at the foot of the phone, Core's, the same inside every Module — Core owns going *between* places, and a Module's own navigation sits in the **Phone dock** just above it, never in it. One is fixed and Core's — the **Calendar**, far left, because time is what the phone is opened for and should never be something a user has to have chosen; it opens on whichever view the Calendar last showed on this device, a memory the Calendar keeps, not the slot. The centre is **capture**, fixed, because the bar's other slots are places to go and capture is a thing to do; it is the one control that must be reachable at thumb height from every page. The other three — one left of capture, two right — are the user's: each points at any destination the Rail offers — a Module, a general Surface, a Screen — or a page inside a Module. A Workspace's bar is its own and travels with it, seeded from that Workspace's own Modules when it is made, and arranged afterwards in **Settings**; so switching Workspace still reconfigures the phone, by the user's arrangement rather than by which shelves the Workspace happens to hold. A slot **goes where it points** and remembers nothing — the Vault's Folder tabs keep their own, and the Calendar its view. A slot whose destination no longer exists goes **empty** rather than being refilled: the bar never rearranges itself under the thumb, and never silently replaces a choice the user made. `☰` is not in the bar: the full Rail opens as a drawer from the header's top left.
_Avoid_: tab bar, dock, bottom nav, navbar, menu (what ☰ opens), tabs (the Vault's Folder tabs are a different thing), toolbar

### Phone dock
The strip right above the Phone bar where a page's controls sit on the phone, under the thumb rather than at the top of the screen (ADR 0064): the Module's tabs against the bar, and above them **one line** of the page's own — tabs and view switches (a select on the phone, never a tab bar), date paging, its search, its main add. Filters beyond a search fold behind one **Filters** button that opens them in a sheet. Whatever is alone on a line takes the full width. Titles, quick-add fields and a single thing's own header (back, edit, delete) stay at the top. On the desk nothing moves. The editor's key bar stacks above the dock, not over it.
_Avoid_: toolbar, bottom bar (the Phone bar is the bar), dock (alone — say Phone dock)

### Capture sheet
What the Phone bar's centre opens: every capture Command the Workspace's Modules offer, found by *where it lives*, never by how often it is used. The user's **pinned** few (a handful — the ones reached for daily) sit on top, always in the same places; below them every capture Command, grouped under its Module in Core's Module order — a pinned one stays in its group too, so pinning never shifts the others. Nothing on it reorders itself: capture is muscle memory, and a Command that moves costs the seconds capture is for. No search of its own — typing is the palette's, which stays the escape hatch, and is how the desk captures: there is no sheet at the desk. Opened empty, the palette shows the same pins in the same order; typed into, it ranks capture Commands first, folded ones included. Pins are the **Workspace's**, like its bar: arranged in Settings beside the Phone bar or by long-press on the sheet itself, and a new Workspace starts with **none** — nothing is guessed. A pin whose Command leaves the Workspace (its Module removed) is dropped and nothing takes its place. A capture Command may be **folded** under a broader one that routes to it — Culture's "Add to Culture…" asks which medium, then opens that App's own form, each App still owning its type and dialog: the folded Command is not listed in its group but stays pinnable and in the palette, so the medium reached for daily is still one tap. Commands fold only when they are **the same act on sibling types, or on one type's templates** — one verb, the medium (or the template) being the only difference, the thought arriving as "a film" rather than "Cinema". A Ledger transaction and a Pocket spend never fold (a fact and a belief are not one act), nor do Progress's logs (different shapes; a fold would only be a menu inside the sheet). The **Calendar** group comes first, ahead of every Module — the Calendar App has no Module, and time is what the bar's left already leads with: "Add event…" for an Event from the head, and "Add today…" with every Event template folded under it.
_Avoid_: quick-add menu, plus menu, launcher, favourites (say pinned), merged or hidden (say folded — nothing is lost)

### Settings
The page where the user configures Lifeline itself rather than any of its content — the current Workspace's **Phone bar**, and Workspace management. Core's, one per install, reached from the foot of the sidebar. The **sixth** kind of page and the only one that serves no Documents: a Card, a Screen, a Surface, an App screen and a Base all present or process Documents, and Settings presents the app. Everything it holds is configuration that had no object of its own to hang off — where configuration *does* have one it stays there, at the thing it configures, as a Card's settings are on the Card and a Base's fields are on the Base.
_Avoid_: preferences, options, config, admin, account (one sign-in, a different axis), Screen (user-composed, of Cards), Surface (Core's, over Documents)

### Task
A unit of work owned by the Tasks App. One-time (optionally assigned to a day) or recurring. Absorbs calendar's old Task/Backlog and week-planner's tasks. Completable; implements Schedulable. May belong to one Project — and then to one of its Milestones and, if one-time, stands in one of its Lanes — or to none, a loose Task. Shelved with the Projects App in the Projects Module.
_Avoid_: todo, item

### Project
An outcome the user can declare **finished** that takes more than one step to reach — "Renovate the bathroom", "Plan the Lisbon trip". Has an end by definition: an ongoing area of responsibility (health, the car) is not a Project — that is what Tags, Workspaces and Modules already are. Lives in the Projects Module beside Tasks. A Task belongs to **at most one** Project, by a link on the Task; a Project's Tasks are whatever links to it, never a list it keeps, and a Task with no Project is simply a loose Task. A recurring Task may belong to one too, but it has no single done state, so it never counts toward the Project's progress. Stands in one of five **stages**: **Planned** (wanted, not started), **Active** (being worked now), **Paused** (started, deliberately parked), **Done** (the outcome reached) and **Dropped** (abandoned, kept as record). Done is **declared, never derived**: ticking the last Task offers to finish the Project and never finishes it, because the outcome is not the task list; finishing one with Tasks still open asks what becomes of them and never deletes them silently. A stage is about the user's attention in the Projects Module only — a Paused or Planned Project's Tasks still stand on every Surface as their own days say. Carries its **Outcome** — one line saying what finished looks like, shown at its head — and an optional body for the plan, written in the Vault. Linkable: its **material** — the Notes, Quotes, Receipts and anything else about it — is whatever links to it, gathered on the Project by type, never a list it keeps and never a Folder, so a Note about the bathroom is simply a Note. Moved to another Workspace, a Project takes its Milestones, Lanes and Tasks with it in the one act; its material has lives of its own and is only offered along, never carried. A single Task moved out of its Project's Workspace leaves the Project, its Milestone and its Lane behind. Dropping is how a Project is let go; deleting is for a mistake, and **releases**: the Project, its Milestones and its Lanes go, its Tasks stay as loose Tasks, done ones still the record of their days — wanting the Tasks gone too is two explicit steps. May wear a **face** (an optional emoji and colour, as an Allowance does), which its Tasks show as a small mark wherever they stand on the Surfaces. Reported on the Daylog when it starts (becomes Active), when one of its Milestones is reached and when it is finished — never when dropped.
_Avoid_: area, goal, epic, initiative, a grouping of Essays (that is their Tag)

### Deadline
The day a Project or a Milestone is meant to be reached by — optional, the user's own promise, beside an optional **start** day. While its Project is Planned, Active or Paused, a Deadline stands on the time Surfaces as an all-day **marker** on its day ("⚑ Bathroom"): taking no hours, so Push plans straight through it, and dragged to another day it changes the Deadline through the Projects App, undoably. Missed, it stays on its own day, red, and never rolls forward — rolling would fake a new promise. It changes nothing by itself: no Task moves, no stage flips. Its Project Done or Dropped, or its Milestone reached, the marker is gone and the Deadline is kept as record on the Project. A hard outside date that work must meet (filing the tax return) is better a dated Task in the Project, which is work and is ticked. The start day never reaches the Surfaces.
_Avoid_: target (the Ledger's monthly amount), due / due date (the Ledger's Due, and a Task's day), end date, ETA

### Milestone
A named checkpoint inside one Project — "Demolition", "Plumbing", "Tiling" — an internal Document owned by the Projects App, put in the user's own order. A Task of the Project sits under at most one of its Milestones, or under none; a Task never sits under another Project's Milestone. Like its Project, a Milestone is reached when the user declares it, never because its Tasks are ticked. There are no subtasks: work big enough to have parts is a Milestone or a Project, never a Task with children.
_Avoid_: phase (fine in prose), stage (a Project's lifecycle word), sprint, epic, subtask, section

### Lane
One column of a Project's **Board**: a step of that Project's own flow — "Quote → Ordered → Delivered → Installed" — named and ordered by the user, an internal Document owned by the Projects App and belonging to exactly one Project. A new Project starts with *To do*, *Doing* and *Done*, all editable. Each of the Project's open one-time Tasks stands in exactly one of its Lanes; moving a Task to another Project drops its Milestone and puts it in that Project's first Lane. One Lane may be the **done Lane**: a Task dropped there is ticked (by the Tasks App), a Task ticked anywhere lands there, and unticked it returns to the first Lane. Deleting a Lane sends its Tasks to the first one, never away. Lanes and Milestones are independent: a Milestone says which part of the Project, a Lane where in its flow. Loose Tasks and recurring Tasks stand in no Lane.
_Avoid_: column (a Base's rendering of a Field), status (a Task's active/archived), stage (a Project's lifecycle), swimlane, list

### Board
A Project's Tasks laid out across its Lanes, dragged between them — the kanban. One per Project, narrowable to one Milestone; there is no Board across Projects, since every Project's Lanes are its own, and none for loose Tasks — wanting one is wanting a Project. Across Projects, the Projects Module shows the Projects themselves by stage instead. Within a Lane, Tasks stand in the user's hand order, and that order *is* priority — there is no priority field. A Project's **next Task** is read from it, never stored: its earliest Task due today or overdue, else the top Task of its first Lane that is not the done Lane and holds any.
_Avoid_: kanban (fine in prose), View (a Base's — a Board layout is a different thing), Screen

### Estimate
How long a Task is expected to take, in whole minutes, guessed in advance — optional, and the user's own. A recurring Task carries one Estimate on its definition and every Occurrence inherits it. It sizes the Time block a **Push** makes; it never records how long the work actually took, and nothing measures it against the blocks.
_Avoid_: duration (what actually passed — a Session's, a Tally's), length (a block's or a template's), effort, points

### Occurrence
One instance of a recurring Task, generated by its recurrence rule (weekly on weekdays, monthly on days of the month, or yearly on dates — month-length dates clamp like Chores). Each Occurrence completes and moves independently. Recurring Tasks have no single "done" state — only their Occurrences do. (Period-reopen semantics are not a Task concept; that need is served by the Chore App.) Occurrences are derived, never stored; only the ones that were moved or completed leave a sparse per-Occurrence override keyed by task + source day. A missed Occurrence **lapses** as soon as the rule produces the next one (ADR 0036): a recurring Task is overdue at most once — for the Occurrence it is currently on — and a lapsed one keeps its day as record, without urgency, still tickable there. Moving an Occurrence onto today or later takes it out of that reckoning.
_Avoid_: period, instance

### Unassigned
A one-time Task with no day yet. It lives in the pool (the Calendar's "Unplaced" drawer) until dropped on a day. Giving it Time blocks does not assign it: it stays in the pool, greyed while a block lies ahead, ready to be blocked again. Recurring Tasks are never Unassigned.
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
A named series the user tracks (push-ups, weight, workouts, countries visited). Defines what is tracked and how values are read — one of four kinds: **Additive** (entries add up), **Measurement** (point-in-time readings), **Boolean** (a day was done), **Collection** (distinct items collected, optionally against a universe size shown as a denominator, or against a preset item list — then logging is ticking items off a checklist and the list's length is the denominator). Holds no totals; kind is fixed after creation. Goals/targets are out of scope.
_Avoid_: metric, counter, habit (a Habit is the Life Level App's XP-bearing track — a Boolean Stat merely tracks days done), goal

### Entry
One logged event of a Stat: a value and the moment it happened (user-settable, backdating allowed), plus an item name for Collections. Totals, streaks and distinct counts are always derived from Entries, never stored; duplicates are collapsed at derivation, never rejected.
_Avoid_: log, record, data point

### Streak
A Boolean Stat's run of consecutive marked days. The current streak ends today or yesterday — an unmarked today doesn't break it. Derived, period-independent.

### Mood
How one day felt, on a fixed five-point scale — 😞 Rough, 😕 Meh, 😐 Okay, 🙂 Good, 😄 Great — one colour per step, owned by the Mood App as its only Document type. At most one per day (its title is the date); re-picking replaces it, and a day with none recorded is an absence, never a sixth mood. Settable on today or any past day — never a future one, which hasn't been felt yet. Reported to the Daylog, so the Day still shows the day's mood; deliberately *not* Linkable — a date title would collide with the Day's, and prose points at the day, not at the feeling. The scale is fixed in code so a colour means the same thing in every year of the grid. Was a `mood` field on the Day until ADR 0044.
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
One logged occurrence of a Habit or Negative activity: a visible ledger Document carrying the moment it really *happened* (occurred-at, user-settable — back-logging covers genuine forgetting) and an optional note. A Negative's Completion also records the Habit it hit: the persisted outcome of the fixed pair or the random roll — a fact, never re-rolled. Completions die with their activity ("honest quitting"): deleting a Habit deletes its own Completions and every Negative Completion that hit it — earned levels and XP debt die together; forfeiting progress is the cost of shedding debt, and deleting a Negative activity likewise takes its own Completions, so the damage it did is undone. One Completion may also be struck out alone — the Undo on the toast that logged it, or the delete on its ledger row — because a mis-tap is not a fact: the ledger keeps facts only, and every number re-derives without it.
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

### Swear Jar
The self-fining App: Offences and the Fines logged against them, a jar of money the user owes themself for things they did. Trust-based — no proof, no witness, no one to answer to. Its own list, deliberately apart from Life Level's Negative activities (which cost XP and need a Habit to hit) and from Pocket (money the user *has*; the Jar is money the user *owes*). Nothing in it is ever a Transaction. The jar is a **month**: what it holds is the sum of the calendar month's Fines, derived at read and never stored — nothing is emptied, paid out or reset; on the 1st it simply reads zero because no Fine has landed yet, and past months stay readable as history. Fines may be backdated, into a past month too.
_Avoid_: penalty, punishment app, reset (nothing is reset — the month turns), payout, Negative activity (Life Level's), budget

### Offence
A named, priced thing the user fines themself for — "Snoozed the alarm · €2" — owned by the Swear Jar App. Its price is a positive amount in the app-wide currency; it may wear a **face** (optional emoji and colour, as an Allowance does). No cap, no limit, no schedule — a jar is not a budget, and a limit would only invite "I'm over already, why stop". Never deleted while Fines reference it — **archived** instead: out of the logging picker, its past Fines and months kept whole. Hard delete only when it has no Fines. Only the user logs against an Offence — it is owned up to, never charged: no other App fines anyone (not Loggable). A single Fine logged by mistake is simply deleted — a mis-tap is not an incident.
_Avoid_: sin, rule, vice, Negative activity (Life Level's), habit

### Fine
One logged incident of an Offence, an internal Document owned by the Swear Jar App: the moment it happened (date and time, user-settable) and an optional note. Carries the amount the Offence cost *when it was logged* — a fact, never re-valued: repricing an Offence changes only the Fines still to come, and a closed month never moves. One Fine is one incident, at the Offence's price, never a hand-typed amount; swearing twice is two Fines. Reported on the Daylog ("€2 · Snoozed the alarm").
_Avoid_: entry (a Stat's), Completion (Life Level's), Spend (Pocket's), transaction (a Ledger fact), penalty, coin

### Media item
_Retired_ — the one Media App split into four family Apps (ADR 0024): **Library** (books, comics, manga), **Cinema** (movies, series), **Discotheque** (albums), **Arcade** (games), plus **Quotes** (born as the Commonplace book) for Quotes. A work is simply a Document of its type — book, comic, movie, series, music, game — owned by its family App; the type ids never changed. Works are still not editions, and still carry a creator (in the Library, **Authors** — Documents of their own since ADR 0052; a string elsewhere), year, size, cover by URL and an optional **Reason** (who sent me here — offered at add, never required). The old "Studied" mark is gone.
_Avoid_: media (as a type id or an App — neither exists), title, copy, edition, studied

### Author
Library only: a person who wrote (or drew) books and comics, as a Linkable Document owned by the Library — "Frank Herbert" — with their other names as aliases so `[[Le Guin]]` and `[[Ursula K. Le Guin]]` land on one Author. A Work names its Authors, several when co-written; the Author's works are what links to it, never a list it keeps. An Author may exist with no outside identity (typed by hand, or inherited from an old creator string) and be resolved later. Has a body: the place for what I think of them. Two Authors that are one person are **merged**: the survivor takes the other's Works, names as aliases, body and (if it had none) outside identity, and the other is gone. Not a Reference of the person type (a person is a user-defined type; an Author is the Library's own), not a Bibliography (that is what the world says they wrote).
_Avoid_: creator (the old field, gone), writer, artist (say Author for both), person (a user-defined type)

### Bibliography
What the world says an Author wrote: their works as Open Library lists them, fetched when you open the Author in the Library and never stored. Each row says whether it is already on your shelf and where; the rest can be ticked and added to *To read* in one go, Wanted and with no Reason. Duplicate titles are folded and year-less rows sink, with the noise one toggle away. Offline there is no Bibliography, only the Author's own backlinks. Not a Playlist (nothing is curated), not a View (nothing is a Document until added).
_Avoid_: works list, catalogue, discography (the Discotheque's word, if it ever has one)

### Shelf
Where a work stands with me, in its family's own verbs: **To read / watch / listen / play** (not started), **In progress**, **Done**, **Dropped**. One shelf per work; every family App's Gallery is browsed by shelf. In the Cinema, the Discotheque and the Library, **Done** is one click from any shelf — a film watched, an album heard, a book read — and clicking again undoes it; Marks and the Review survive either way, and in the Library finishing frees the Nightstand Slot, which undoing never takes back (re-slotting is deliberate).
_Avoid_: status (too generic), backlog, engagement (the internal field name)

### Part
A numbered piece of a work, for the works made of them: a comic's **Issues**, a manga's or a book's **Chapters**, a series' **Episodes**, an album's **Tracks** — Part is the term, the medium's own word is what the user reads. Owned by the work's family App, belonging to exactly one work. Optional: a work has Parts only once the user tracks them, and a work without them behaves as before; films and games never have Parts. A Part has its number, an optional title typed by hand, its own read (watched, heard) day, its Marks and its Review. A Part exists only once it has something to say — a read day, a Mark, a Review; the rest of the work's run is simply the numbers its size describes. **Caught up to** N marks every Part up to N read *with no day* — "before Lifeline" — in one act, so a work added mid-run never needs its past ticked one by one; nothing of it lands in the Daylog. It is one position on the work — a number, or season and episode where numbering restarts — and catching up again moves it. **Next part** — the lowest unread Part, read today — is the everyday act, one tap from the work on the In progress and Nightstand Cards. Parts die with their work, follow it to another Workspace, and survive a change of medium, only their labels and numbering changing. Progress ("14 of 54") is derived from the Parts, never stored. The work's size is the run as far as it is known: reading or catching up past it raises it, and a blank size is **ongoing** — an end not yet known. The first Part read on an unstarted work starts it, exactly as **Start** does; reading the last known Part *offers* Done and never sets it — a work with no known end never offers. One read day per Part, the latest; rereads are not kept. A Part's Marks never roll up into its work's: an average may be shown beside them, never stored. The Daylog says one line per work per day ("Read 3 chapters of One Piece").
_Avoid_: issue, chapter, episode, track (each fine as the medium's label, not as the term), item, entry

### Group
An optional numbered collection of a work's Parts, one level only — a series' **Seasons**, a manga's or a comic's **Volumes**, an album's **Discs**, a book's **Sections**. Like a Part it carries its own Marks and Review, and exists only once it has something to say. Whether Part numbers restart in each Group is the medium's, never the work's: a series' episodes and an album's tracks restart (S2E1), a manga's, a comic's and a book's chapters run on across Volumes. So a restarting Group is declared by its own size ("Season 3 has 8 episodes"), a running-on one by its first Part ("Volume 104 starts at chapter 1045", ending where the next begins) — and declaring it is enough for it to exist. Its Marks are its own, never an average of its Parts'.
_Avoid_: season, volume, disc (each fine as the medium's label, not as the term), arc (a story's, not a structure's), set

### Gallery
A family App's main screen and the view you land on: the wall-to-wall cover grid of everything the App owns, narrowed by Shelf, search and — where the App owns several types (Books|Comics|Manga, Movies|Series) — a medium chip. Landing is always on All, never pre-filtered.
_Avoid_: library (an App), grid (a rendering), backlog

### Nightstand
Library only, for books, comics and manga: the small capped set of items currently claiming attention — in progress and next up. A Slot is held for the whole time an item is in progress and freed only by finishing or dropping. Caps are fixed in code (books 5, comics 3, manga 3); no other family has slots. A Nightstand item that isn't owned yet is the instruction to buy it *now* — it heads the Wanted list. Lives in its own tab, never on the Gallery.
_Avoid_: queue, TBR, wishlist, priority

### Wanted list
Every Wanted work of a family that still has **Acquisition** — Library and Arcade only (streamed media are never owned, so Cinema and the Discotheque have no Acquisition at all): Nightstand ones first (next up — buy now), then the rest, oldest first. Marking one as acquired takes it off the list; in the Library, **Bought** is one click on the work itself — Wanted ⇄ Owned, clicking again un-buys — while Borrowed and Gone stay deliberate menu moves. The Shelf never moves the list: a book read but still Wanted stays on it. A Card per App, never furniture on the Gallery.
_Avoid_: wishlist (that word hides the buy-now head of the list), cart, shopping list (the Shopping list App's own list)

### Marks
Cinema, the Discotheque and the Library: what I make of a work, beside where it stands on the Shelf. **Liked** (a heart, on or off) and a **Rating** (one to five whole stars; unrated is its own state, not zero stars). Each is one click on the Gallery tile or the detail; neither implies the other, neither moves the Shelf, and a Shelf move never touches them. Marks are facts about the work, not events: nothing lands in the Daylog, nothing feeds Life Level.
_Avoid_: score, favourite (say Liked), half-star, vote

### Review
Cinema, the Discotheque and the Library: my own words about a work — its Document body. One per work, written from the detail, and everything a body gives for free follows: opened as text with the fields as frontmatter, wikilinks, `#tags` counted, Backlinks. Not a Note (a Note is about one thing the work said; a Review is about the work), not a Quote (a passage is the work's words).
_Avoid_: comment, notes (a Note is a Document), diary entry (there is no diary — one Shelf, one Review per work)

### Playlist
Cinema and Discotheque only: a named, ordered selection of works I curate by hand — "Films for a rainy Sunday", "Albums of 2025" — with an optional blurb (its body) and optionally **ranked**, which shows the order as numbers. Membership belongs to the Playlist, never to the work: a work sits in any number of Playlists, a deleted work simply leaves them. Each App owns its own Playlists over its own works (movies and series together in one; albums in another) — no Playlist crosses families. Lives in its own tab beside the Gallery, like the Nightstand does. Not a View (a View filters; a Playlist is chosen and ordered by me), not a Tag (unordered, no blurb), not the Shelf (a Playlist says nothing about whether I've seen it).
_Avoid_: list (a Base word and a layout), collection (a Stat kind), watchlist (that is the To watch shelf), queue, exhibition (the Museum's word)

### Note
A body-first Document in the **Notes** Module: my own words about a **Source** — what struck me in the podcast, the chapter, the article — and impossible without the Source it links to. Made from the Source, kept on the Source, found through the Source. A thought with no Source is a **Thought**; my words about a whole work for its own sake are a Review.
_Avoid_: document (the general block), page, file, thought (no source), jot, annotation

### Thought
A body-first Document in the **Thoughts** Module: something that comes straight out of my head — an idea, a feeling, a reflection, a question (its optional **kind**) — with no Source, not tied to a day, not part of a Manuscript. It may mention anything; what it never has is a Source. Attaching one **converts** it into a Note, and detaching a Note's Source converts it back — one deliberate act that keeps the Document, so links to it survive. Never processed or emptied: Thoughts are a stream, not an inbox. Not a Mood (a Mood is one day's feeling on a fixed scale; a Thought about how I feel is prose).
_Avoid_: note (that has a Source), idea (one kind of Thought), journal entry, fleeting note, mind

### Clipping
_Retired_ — a passage taken from outside is a **Quote**, and every Quote has a Source.

### Reference
Not a type: the informal name for any Document about a real-world thing (a person, a place, an organisation, a work) that other Documents link to. Person and place are user-defined types; works (books, films, albums, games) are References owned by their family App, Artworks by the Museum App. What makes something a Reference is being Linkable, not its type.
_Avoid_: entity, contact, using "Reference" as a Document type name

### Writing
_Retired_ — prose that *is* the thing splits by what it is built from: an **Essay** (argued from material, in Research) or a **Manuscript** (made up, in Manuscript).

### Essay
A body-first Document in the **Research** Module: prose that argues from my material — Notes, Quotes, Sources, Thoughts — an essay, an article, a thesis, a Talk. Its **material** is what it links to, plus what I pin to it; **candidates** are the Documents one link away from that material, offered and never added on their own. Essays on one topic are grouped by Tag; nothing contains them. May have Versions.
_Avoid_: writing (retired), paper (fine in prose), article, draft (a state)

### Manuscript
A creative work I write in the **Manuscript** Module — a novel, a collection of poems — made of ordered **Chapters**, its own body holding the outline and plan. Has a status (draft, revised, done), not a separate draft type. Shown on the Manuscript Module's shelf of works. Not an Essay: it is made up, not argued from material.
_Avoid_: book (a Library work), project (a Projects word), novel (one kind), writing

### Chapter
One ordered part of a Manuscript, with a body of its own. May have Versions.
_Avoid_: section, part (fine in prose), scene (finer than a Chapter)

### Outtake
An internal Document type: a passage cut from a Chapter and kept with its Manuscript, so cutting never loses words. Restoring one puts it back as a new edit.
_Avoid_: deleted scene (fine in prose), trash, scrap

### Version
An internal Document type: a snapshot of an Essay's or a Chapter's body taken on purpose by pressing a button — never automatic. Versions are kept side by side with the current text for comparison; restoring one is a new edit, not a rewind.
_Avoid_: revision, history (implies automatic), backup (fine in prose)

### Note type
_Retired_ — use **Document type**. (Was: a kind of Note fixing its title rule, Properties and template.)

### Field
A typed value a Document type declares (mood, aliases, birthday, geo, employer…), edited as a form, shown as a Base column, and read/written as frontmatter when the Document is opened as text. Kinds: text, long text, number, boolean, date, datetime, select, multi-select, url, geo, list of text, and **Link**. No formulas — a computed value belongs to a View, not a type. Every type has its own Fields, and the user may add Fields to any type, built-ins included; a built-in's own Fields stay its App's, the user's sit beside them. A Field is fixed once it exists: it can be relabelled, and its kind changed only to one every value it already holds still fits; removing it keeps the values Documents hold, and they return if it is added back.
_Avoid_: property (old Notes word — same thing), metadata, attribute, column (a View's rendering of a Field)

### Link (field)
A Field holding a reference to another Document, optionally restricted to one type (`employer → organisation`). Stored by id, written as a wikilink in frontmatter, clickable in Bases, and a source of Backlinks exactly like a wikilink in a body.
_Avoid_: relation, foreign key, reference

### Template
A body a Document type offers as the starting text for a new Document of that type — the Day's sections, a meeting Note, a Chapter skeleton. Every type has its own Templates; picking one copies it into the new body once and forgets it, never a link. A user-defined type's starting body comes only from its Templates; a built-in type may also carry a default of its own, used when it has none. Not an Event template (that shapes an Event, not a body).
_Avoid_: note template (old name), template (bare, when an Event template is near), preset, skeleton

### Day
The Journal's Document for one day, titled by its date — at most one per day, made from the Day's Template on first use: the day's page, carrying a Daylog block and showing the day's Mood. Was the "daily note" until Note came to mean writing on a Source.
_Avoid_: daily note (old name), journal entry, log, diary page, entry (a Stat's)

### Week, Month, Quarter, Year
The Journal's review Documents for a longer stretch, one each per ISO week (`2026-W42`), month, quarter and year, titled by that stretch: each with its own Template, the Daylog rolled up over its days, and a way through to the Days and shorter stretches inside it.
_Avoid_: weekly note, review (a Review is my words on a work), period summary

### Journal
The Module for living day to day in writing: Days and their Weeks, Months, Quarters and Years, the user-defined types they talk about (people, places…), and a writing interface of its own built for heavy markdown pages. Agnostic about what those other types are — the user defines them and homes them here. The Journal lists them as its **Types** and is where the user creates, edits and deletes them: a type made here is homed here, and one re-homed elsewhere leaves. It manages only the user-defined types homed in it — built-in types and types homed elsewhere are managed from Bases.
_Avoid_: diary, vault (the raw editor), collections (for its Types — a Collection is a Stat kind)

### Wikilink
`[[Name]]` in any Document's body. Resolves by name — case- and accent-insensitive, spaces collapsed — across every Linkable Document type — exact title first, then alias — with an optional type prefix (`[[media:Dune]]`) to disambiguate; once resolved, the link remembers its target so later collisions don't move it. Unresolved links stay unresolved (click to create a Note). The editor's completer shows the type of each candidate.
_Avoid_: reference, mention (a mention is what the *target* sees)

### Backlink
From the target's side: a Document that wikilinks to it. Every Linkable Document has backlinks ("mentioned in").
_Avoid_: incoming link, reference

### Unlinked mention
A Linkable Document's title or alias appearing as plain prose in another Document's body, with no wikilink around it. Derived, never stored; offered from both ends in the links panel — the target sees who mentions it, the source sees which names it could link — and turned into a Wikilink only on request, never silently. A Document type may opt its Documents out as targets (Days). Not a Backlink (that needs a link).
_Avoid_: unlinked reference, suggestion, candidate

### Linkable
Core Contract: a Document type whose Documents are wikilink targets by title and alias, and receive backlinks. Declarable by data (a user-defined type just says so).

### Role
A built-in type's fields and behaviour lent to a Document of another type, so one Document can be two things: my user-defined Person `Ursula Le Guin` wears the **Author** Role, and her books link to her. A Document still has exactly **one type** — which decides its owner, title, body and Home Module — and any number of Roles. A Role's fields belong to the App that defines the Role; taking a Role off keeps the Document and drops only that Role's fields. Every Role comes with a **home type** for Documents that are that and nothing else (Library's Author, the Notes App's Source). **Source** and **Author** are Roles; my own words (Note, Quote, Thought, Day, Essay, Chapter) never wear Source.
_Avoid_: type (a Document has one), tag, trait, mixin, subtype

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
Core Contract (behaviour — code only): an App reports what *happened* on a day — completed tasks, chore completions, logged entries, media started/finished, events. Rendered live wherever a Daylog block appears (a Day's fenced `daylog` block, or a Card); never written as text.
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
A **Role**: what a Document wears when I take Notes and Quotes from it — a book, a film, an album, an article, a podcast episode, a video, a person I heard speak — and the hub I take them from: a Source gathers its Notes and Quotes, and is where new ones start. A Source may belong to a **parent Source** (a show and its episodes, a magazine and its articles), whose page gathers its children's Notes and Quotes too; a page or a minute is a **locator**, never a Source. Works keep their own type and family App and simply wear the Role; what is nobody else's — an article, a podcast, a video, a website — is the Notes App's own Source type. Shelved in the **Notes** Module by kind and Tags.
_Avoid_: origin, reference (any Linkable thing), work (one kind of Source), window (the old meaning)

### Window
Something outside Lifeline shown inside it, unowned and not understood, kept by the Windows App in the Notes Module — a Feed's item becomes a Source in one tap. Kinds: Embed, Feed, Calendar subscription, Live value. Named, tagged and pickable for a Card; Lifeline never owns the data behind it. Was called "Source" until Source became the hub of Notes and Quotes.
_Avoid_: source (the hub), integration (that is an App talking to a service), widget

### Embed
A Window kind: a web page shown as-is in a frame, by URL. Lifeline displays it and does not understand it; a page that refuses to be framed stays blank and can only be opened outside. Optionally reloads itself on a period.
_Avoid_: iframe (a rendering detail), link (that's a Wikilink), bookmark

### Feed
A Window kind: an RSS/Atom URL Lifeline reads and lists — latest items, opened outside. Remembers only "seen up to when"; never the items themselves.
_Avoid_: reader, subscription (that's a Calendar subscription), channel

### Calendar subscription
A Window kind: an iCal URL whose events appear on the time Surfaces as read-only Timed items in the subscription's colour. They are never copied into the Calendar App's Events and can't be moved or completed.
_Avoid_: external calendar, imported calendar (nothing is imported), feed

### Live value
A Window kind: a URL polled on a period, from whose response one value is read (a JSON path or a regex capture) and shown as a tile with a label and unit. Shows when it was last read; goes stale, never fakes.
_Avoid_: metric, sensor, stat (a Stat is owned data with history — a Live value has none)

### Conflict copy
A sibling Note "<title> (conflict HH:MM)" saved when sync would have overwritten unsynced local edits. Nothing is merged, nothing is lost.

### Workspace
**A separate world of data, with the Modules that world needs.** One **default** Workspace reads the shared content; every other Workspace the user creates is **separated** — it holds its own content and sees nothing else. "Work" takes Tasks and Research and holds work's Documents; the general Calendar in Work shows work's Tasks and Events and nothing personal, and Money is simply not there. The choice of Modules decides which Modules stand at the top level; separation decides the data. There is no Workspace that shares the default's data with fewer Modules — that was only ever a shorter sidebar.
_Avoid_: mode, space, profile, Account (one sign-in, a different axis), Module (what a Workspace takes)

### Separation
What every Workspace but the default is: its content kept to itself. Every Document is either **shared** or **held** by one separated Workspace — a single field, empty for shared, exactly as a Folder is root when empty — and a Workspace reads **one of those and no other**: a separated one sees only what it holds, the default sees only what is shared. A strict partition, not an overlay: nothing is visible from two Workspaces, and a separated Workspace does *not* also see the shared content. So a new Workspace **starts empty**, and content crosses only by being **moved**, one deliberate act, the way a Document is moved between Folders. Separation is what isolates; Modules never do. Deleting a Workspace **releases** rather than destroys: its held Documents become shared, its Screens move to the default Workspace, and only then is the Workspace gone — a container never takes content with a life of its own down with it, as deleting a Workout keeps its Sessions. Wanting the data gone is still two explicit steps: empty it, then delete it. There is always at least one Workspace, and the last cannot be deleted.
_Avoid_: pool (the Calendar's Unplaced drawer), private (the Private folder is a different gate), partition, tenancy, sandbox, sync (unrelated)

### Held / shared
Which content a Document is. **Shared** (the default, the field empty) means every unseparated Workspace sees it and no separated one does. **Held** means exactly one separated Workspace sees it. No type is exempt — a separated Workspace with the Progress Module starts with an empty Exercise library and curates its own, because the reason to separate a Money Workspace is precisely that its Accounts and Categories should not be the personal ones. The types that are genuinely universal repair themselves by being used: a separated Workspace builds them up again from use rather than importing them.
_Avoid_: private, owned (an Account owns), scoped, global (say shared)

### Frame
_Retired_ — it was the Vault/Dashboard axis (what you *do*), two chromes chosen by URL. Chrome now follows the **Module** (what it is *about*): each Module ships its own layout, so a separate word for "the chrome around a Module" names nothing the Module does not already. The Vault survives as the raw editor for bodies; the Dashboard is retired.
_Avoid_: Frame (say the Module, or the Vault)

### Attachment
A file — for now an image — dropped or pasted into a Document's body and kept by Core beside the content: bytes, filename and kind, nothing else. Not a Document: no type, no Base, no Folder, no Tags, absent from the Vault tree; it exists only to be embedded from bodies by name, and any body-first type may embed one. Renaming it rewrites every embed, as renaming a Note does. Deleting the embed never deletes the Attachment: one no body embeds any more is **orphaned**, kept, and removed only when the user asks to clean up.
_Avoid_: image (the kind, not the thing), file (a storage detail), asset, upload, media (the retired App)

### Vault
The **raw** editor for bodies, as a Base is the raw editor for fields: tree, search, tags, links around a markdown editor over any Document's frontmatter and body, whatever its type, for bulk and plain-text work. Not where bodies are *meant* to be written — each writing Module (Journal, Manuscript, Research, Notes, Thoughts) has its own interface — but always there, and any body with no interface of its own opens here. Not a storage place — Documents live in one store whatever shows them.
_Avoid_: notes (one type), library, folder, journal (a Module)

### Dashboard
The Frame where data is **read and operated**: Screens of Cards, Surfaces, App screens and Bases. What changes here changes through a defined operation — a form, a dialog, a click whose effect is known — never through free text. An App screen lists, filters and starts things; the body it opens belongs to the Vault.
_Avoid_: home (the phone has none; say the Screen), main app, frame (say which), workspace (a different axis)

### Folder
Where a Document lives: a `/`-separated path (root when empty). Every Document has one; only the Vault cares — its tree, and the phone's Vault tabs, which *are* Folders. A Folder exists because Documents are in it; titles are unique within a Folder for a given type. Each body-first type has its home Folder, Days in `Journal/YYYY/MM`, templates in `Templates`, private ones in `Private`. A type's home Folder is where a new Document of it lands, never a rule about where its Documents may live — a Note in `Private` is still a Note. What a Folder decides is what "+" creates in it; what furniture a Document gets is decided by its type, never by where it sits.
_Avoid_: directory, category (that's a Document type), tag

### Private folder
The one reserved Folder, `Private` at the root (subfolders included), whose Documents are shown only while it is **unlocked**. It exists once the user has **set it up** — chosen its password — and adopts any plain `Private` folder already there. Only body-first Documents may be created or moved into it; no Task, Event or other App Document ever hides there. A gate, not a safe: it keeps eyes off, not bytes secret — the text is stored like any other Document's. Same password on every device, usable offline; resetting it needs the account password and loses nothing.
_Avoid_: vault (the Frame), encrypted/secret notes (they are not), locked folder (say "the Private folder is locked"), hidden folder

### Locked / Unlocked
The state of the Private folder on this device, right now. **Locked** (the default — after a reload, after idle, after the app goes to the background, on a device that has not yet learnt the password) means its Documents are absent from everything: tree, search, links and backlinks, unlinked mentions, Graph, Bases, Cards, autocomplete, tag vocabulary. The folder itself still shows, closed; a link into it shows as locked and asks for the password rather than pretending the target does not exist. **Unlocked** means they behave like any other Document until the user locks again or the timeout does. Anything that must see every body — Attachment clean-up — refuses to run while locked rather than peeking.
_Avoid_: hidden (locked Documents are absent, not hidden in place), logged in / signed out (that's the account), open / closed (a Folder node in the tree)

### Commonplace book
_Retired_ — the App became **Quotes**, then the **Notes** App (ADR 0070), which owns Sources, Notes and Quotes; its id `commonplace` and ADR 0024 keep the old name.

### Bible study
_Retired_ — the Bible App is retired, and with it its Verses, Chapters, Books, Characters and Concepts. Study material is Notes and Quotes on Sources like any other.

### Talk
Not a type: an Essay I give aloud — a sermon, a study-group talk — marked by a `talk` Tag. The day it is given is an Event, since a talk is given more than once.
_Avoid_: sermon (fine in prose), speech (that's something I *heard* — a Note or Quote on it), presentation

### Quote
A passage taken from a **Source** — a line of a book, a minute of a podcast, a pasted article — its text (short or long), an optional locator (page, chapter, timestamp), an optional comment and tags, owned by the Notes App and impossible without the Source it links to. Not my words. Absorbs the old Clipping. A Quote may be **kept**: given a Topic, it becomes Recallable with one Prompt — shown its Source and locator, recall the passage (its comment shown with the answer). Its Topic is chosen the first time it is kept and never moves, as a Word's never does; kept again, it returns there. Unkept Quotes stay out of every Practice; unkeeping keeps its Recalls, as pausing does. Its Prompt is known by the Quote, not by its text: fixing the passage never resets it, as editing a Word never does.
_Avoid_: clipping (retired), highlight, excerpt, web clip

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
_Avoid_: shopping list (a list you write — running low is read), reorder point, restock threshold

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

### Shopping list
The App for things to buy at the next chance: anything that crosses the mind, written down in seconds so it is remembered in the shop. Owns Needs and Aisles; shelved in the House Module beside Pantry, and its add is a capture Command, so it sits on the phone's capture sheet.
_Avoid_: wishlist, cart, errands, Wanted list (Library and Arcade's Wanted works)

### Need
One thing to buy, owned by the Shopping list App: a title in my own words ("AA batteries", "card for Mum") and an optional note (how many, which brand, "the blue one") — nothing structured, so it is written in seconds. Has no day and is never Schedulable — the right moment for it is a place, not a time. Ticked in the shop, it is **Bought**: dated, off the list, kept — and typed again, the same Need comes back to the list, Aisle and note and all, rather than a second one being made; a wrong tick is simply undone. One Need per thing, however often it is bought: the same thing is the same title, case and outer spaces aside — "Milk" is "milk", "oat milk" is another Need, and nothing is merged on a guess. Adding one already on the list makes nothing new, and renaming a Need onto another's title is refused. Deleting a Need, listed or Bought, forgets it for good — how a one-off stops being offered back. Also made from any App's Handoff through the Shopping list's Intake — Pantry sends a running-low Provision this way — and a Handoff naming a thing already Bought brings that Need back like typing it would. Never recurs: a staple that keeps running out is Pantry's running low, not a Need that repeats. Not a Task (a Task is work on a day; planning a trip to the shop is a Task, and its Needs stay on the list). Deliberately *not* Linkable — "milk" is a word, not a subject, and would swallow every `[[milk]]` meant for something written about. Not a fact for the Daylog — the Receipt is.
_Avoid_: item (Media item is taken), entry (a Stat's), errand, task, grocery

### Aisle
A loose, user-defined heading the Shopping list is grouped under — "Supermarket", "Pharmacy", "Online", whatever is handy. Aisles are put in my own order — the order I walk them — and a Need sits under at most one; one without an Aisle is buyable anywhere and heads the list. A grouping for reading the list, nothing more: it says nothing about which Shop, and nothing is refused for being in the wrong one. Deleting an Aisle is never blocked: its Needs simply become buyable anywhere.
_Avoid_: section (the sidebar's and the Bible's), shop (Prices' chain), Storage (Pantry's), category (the Ledger's)

### Mail
The email App: a window onto Gmail, never a copy of it. Owns Mailboxes; reads messages live from Google and keeps them only in a local cache, so nothing about a message enters the Document store unless the user keeps it on purpose. Reads and triages — archive, mark read, star, label — and never sends: replying opens the message in Gmail.
_Avoid_: email client (fine in prose), inbox (one label), mail app

### Mailbox
One connected Gmail address, owned by the Mail App and Linkable: the address, a display name, a colour, Tags. Lifeline stores no credential for it anywhere: a device reads a Mailbox while it holds a Google sign-in for that address, granted in a Google window when needed, and a Mailbox whose sign-in has lapsed on this device is **signed out** — shown, not readable, one click from asking Google again. Deleting a Mailbox forgets nothing at Google.
_Avoid_: account (the Lifeline sign-in, and the Ledger's place money lives), inbox (a label inside a Mailbox), profile, identity

### Thread
One Gmail conversation as the Mail App lists and triages it — the row in the list, the thing archived, starred or marked read, exactly as Gmail would do it. Not a Document: read from Google into a local cache and never synced. Opening one shows its Messages.
_Avoid_: conversation (fine in prose), email (ambiguous — say Thread or Message), item

### Message
One email inside a Thread — sender, recipients, date, subject, body — as read from Gmail. Not a Document and never stored beyond the local cache; **keeping** one hands it as a Handoff to an Intake of your choosing — a Quote (subject as title, sender as author, sent date as published, the Gmail link as source), a Task, an Event. The Thread is what you triage; the Message is what you read and keep.
_Avoid_: mail (the App), email (fine in prose), letter, clipping (what keeping makes)

### Label
A Gmail label as the Mail App reads it — Inbox, Starred, and the user's own — belonging to one Mailbox and living at Google. The list is narrowed by one Label; triage adds or removes one on a Thread. Never a Tag: a Thread is not a Document, and keeping a Message carries no Label across — the Quote is tagged by hand.
_Avoid_: tag (Lifeline's word, on Documents only), folder (a Document's place), category (Gmail's own tabs are not surfaced), mailbox (the connected address)

### Triage
What the Mail App does to a Thread, always at Google and never in Lifeline's own store: archive (out of Inbox), mark read or unread, star or unstar, add or remove a Label, and trash (Gmail's thirty-day bin). Nothing else — no spam, no permanent delete, no mute, and no snooze, which Gmail does not expose. Keeping a Message is not triage: it makes a Quote, a Task or an Event through an Intake and leaves the Thread where it is.
_Avoid_: process, action (a Command's word), sort (a View's)

### Languages
_Retired_ — the App and its Module folded into **Knowledge** (ADR 0073), which owns Word and Sentence now; its id `languages` and ADR 0058 keep the old name.

### Word
A piece of vocabulary the user met and chose to keep, owned by the Knowledge App: the term (which may be several words — "tener ganas de"), its meaning in the user's own words, optional notes, and an optional **origin** — where it was met: a link to the Document it came from (a Note, a Quote, a Source), else a URL or a few words ("Pedro at dinner"). A linked origin is followed, never copied — the Source it counts toward is read through it, so a Note given another Source takes what was kept from it along, kept because remembering the encounter helps remember the word. Yields two Prompts: **forward** (shown the term, recall the meaning) and **reverse** (shown the meaning, recall the term). Editing a Word never resets it: its forward and reverse Prompts stay the same Prompts whatever is fixed. Added by hand, by a capture Command in seconds, or through its own Intake from a Handoff (the selected text becomes the term). A Word or Sentence may be **paused**: still listed, its Recalls kept, its Prompts out of every Practice until unpaused, when the schedule resumes from its Recalls (overdue, honestly, if time has passed). Deleting one takes its Recalls with it — they mean nothing without their Prompts — and every Deck simply loses it. Deliberately *not* Linkable, nor is a Sentence — practice material, not a subject: `[[casa]]` or `[[pan]]` would swallow links meant for other things, and one term may exist in two Topics.
_Avoid_: vocab, term (one of its fields), card, flashcard, entry (a Stat's), lemma

### Sentence
A sentence or short passage the user met or wrote, with one or more parts marked as blanks, owned by the Knowledge App — "Tengo {{ganas}} de comer" in *Spanish*, "Westphalia made {{state sovereignty}} the basis of the European order" in *History*. May carry a **translation** in the user's own words, shown with each of its Prompts so a blank has one answer, not several ("Tengo ____ de comer" — *I feel like eating*). Carries an optional origin like a Word; most often made through its own **Intake** from a Handoff — a passage selected in a Quote, a Note or a Mail Message, its origin kept. Yields one Prompt per blank, and a blank is known by its own text — adding, removing or reordering blanks leaves the others' Recalls where they were, while changing a blank's text makes a new Prompt that starts fresh (the old one's Recalls stay, counting for nothing). "Cloze" names the technique, not the thing.
_Avoid_: cloze (the technique), phrase, example, card, passage (fine in prose)

### Fact
Something the user chose to keep, put as a **question** and its **answer** in their own words, owned by the Knowledge App — "When was the Peace of Westphalia?" → *1648*; "What does the categorical imperative demand?" → *act only on a maxim you could will as universal law*. Yields one Prompt, forward only: unlike a Word, its answer is no cue for its question. Carries optional notes and an optional origin like a Word, and is most often made through its own Intake from a Handoff — a line selected in a Note or a Quote, kept as its origin and shown beside the dialog while the user writes the question and answer themself; the selected text is never put in as the answer. Editing never resets it. May be paused like a Word. Not Linkable, for the same reason. Not a Note (a Note is my thinking about a Source; a Fact is one thing pulled out of it to be kept) and not a Quote (not someone else's words).
_Avoid_: question (one of its fields, and a Thought's kind), card, flashcard, Q&A, note

### Prompt
One question derived from a Recallable Document by the App that owns it — a Word's forward or reverse, one blank of a Sentence. Never authored by hand: the user writes the Document, its App derives the Prompts. Never stored either: a Prompt's schedule, which is the Knowledge App's — when it is next **due**, how well it is held — is derived at read by replaying its Recalls, so each Prompt is scheduled on its own and nothing can drift from the Recalls it came from. A Prompt with no Recalls yet is **new**; new Prompts enter practice at most the Topic's **daily new cap** at a time (oldest added first), always after the Prompts already due — a throttle so a big day of adding never buries what is at risk of being forgotten, never a goal to meet. Two Prompts of the same Word or Sentence never come back to back.
_Avoid_: card (a Screen's UI block), flashcard, question, item

### Recall
One attempt at a Prompt: the user recalls the answer in their head, reveals it, and grades themself **pass** or **fail** — two answers, never a scale of how hard it felt, and never typed in or checked by the App; the grade is always the user's. A fact, stored as an internal Document owned by the **Knowledge** App with its Prompt and the moment it happened: the Recalls are the only thing kept about practice, whatever App the Prompt came from, and every schedule and figure is read from them. The schedule is policy — a change to how Recalls are valued re-values every Prompt at once. A mis-tapped Recall is struck out and everything re-derives without it.
_Avoid_: review (Cinema and Discotheque's body), attempt (fine in prose), answer, rep, entry

### Deck
A user-made grouping of Recallable Documents of one Topic, owned by the Knowledge App, so a Practice can be narrowed to it ("Kitchen", "Work emails"). The user chooses what goes in; nothing is filed automatically. Membership belongs to the Deck, never to the Word: a Word sits in any number of Decks, and a deleted Word simply leaves them. Not a Tag — a Tag crosses every type and every Topic; a Deck is a chosen set inside one Topic, and what a Practice is narrowed by.
_Avoid_: collection (a Stat kind), list, set, Playlist (Cinema and Discotheque's), tag

### Practice
One sitting of Recalls, owned by the Knowledge App: due Prompts first, then new ones up to the daily new cap. Either **everything** — every due Prompt across all Recallable material at once — or narrowed to one Topic, and further to one Deck; or narrowed to one **Source** — what was kept from it, its child Sources' included, read from each item's origin and never filed by hand (each Topic's cap still counts across the whole Topic). In *everything*, each Topic's cap still holds for its own new Prompts. Stored nowhere — the Recalls it leaves are the facts; stopping halfway loses nothing.
_Avoid_: session (a Workout's run), review (Cinema's body), round, lesson, drill

### Retention
The share of a Topic's Recalls (or of all of them) passed over the last 30 days, leaving out each Prompt's very first Recall (meeting it is not remembering it). Derived, never stored; the one figure the Knowledge App gives about how practice is going, beside what is due today, what new Prompts are waiting, and the due counts of the week ahead. No streak, no heatmap, no score — Life Level owns those, reached through a Tally.
_Avoid_: accuracy, score, mastery, success rate, known / held (no threshold decides that a Prompt is learnt)

### Language
_Retired_ — the partition became the Knowledge App's **Topic**; every Language became a Topic of the same name, with its cap, Tallies and archive.

### Topic
What the user keeps material in — *Spanish*, *History*, *Philosophy*, *Biology* — created by the user and owned by the Knowledge App. The partition of Recallable material: every Recallable Document belongs to exactly one Topic, whatever App owns it, and a Deck never mixes two. Carries the **daily new cap** for its Prompts (10 unless changed) and its own Retention. May carry Tallies: a day with at least one Recall in the Topic is one occurrence, logged at that first Recall. Never deleted while it holds anything — **archived** instead: out of the switcher and out of *everything*, no Practice, its Tallies silent, everything kept; unarchived, it resumes where its Recalls left it. Hard delete only when empty. A lens inside one Module, never a Workspace, and never a Tag — a Tag crosses everything; a Topic is the one place a thing is practised in. Deliberately coarse and *not* Linkable: a practice partition, not a subject to write about. Synthesis — Stoicism, the Thirty Years' War — is written in the Notes Module, and the only bridge between the two is each Word, Sentence or Fact's origin.
_Avoid_: subject, field (a Document's typed value), discipline, Language (retired), category, folder, course

### Knowledge
The retention-and-synthesis App and the Module of the same name: it owns every Recall and every Practice over all **Recallable** material, whatever App it comes from — a Word, a Sentence, and what is kept from history, science or philosophy. Retention and synthesis, **never acquisition**: Lifeline never originates material or decides what is learnt next — no curricula, no paths, no suggested items; meeting new material happens outside, and understanding is written in the Notes Module. Nothing arrives in bulk: each thing kept was chosen. And nothing is phrased for the user: a Fact's question and answer, a Word's meaning, a Sentence's blanks are always their own work — writing it is part of keeping it — so no helper or agent drafts them, one at a time or many; an agent may add only what the user dictates word for word.
_Avoid_: learning (conflates acquisition with retention), study, course, curriculum, lessons, flashcards
