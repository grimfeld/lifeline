# Phone controls sit in one line above the Phone bar

On a phone a page's controls were at the top of the screen, out of the thumb's
reach, and each page laid them out its own way: tab bars, chip rows, toolbars
stacked two and three deep. They now sit in the **Phone dock**, right above the
Phone bar, under rules every page follows. On the desk nothing moves.

## The rules

1. **Controls go in the dock.** Whatever changes what the page shows — tabs,
   view switches, date paging — its search, and its main add. Wrap them in
   `PhoneDock` (`@lifeline/ui`); on the desk it renders them in place.
2. **What stays at the top**: the title and its counts, quick-add fields,
   banners, content, and the header of a single thing's own page (back, edit,
   delete). An immersive page (the workout timer) keeps its own layout.
3. **One line, as much as possible.** The page's dock is one wrapping row that
   every `PhoneDock` on the page pours into. Don't add rows; let them share.
   Filters beyond a search go behind one **Filters** button (`PhoneFilters`),
   which opens them in a sheet from the bottom with a count of those set.
4. **Alone on a line → full width.** Every item in the dock grows to fill its
   line; icon buttons keep their size. So hand the dock controls, not
   wrappers: a div around a group grows while its buttons don't — mark it
   `max-md:contents`. A Select's trigger fills its share; text buttons stretch.
5. **Selectors, not tabs.** Tab bars are cramped and fiddly under a thumb. A
   shadcn `TabsList` renders as a select on a phone by itself; a hand-made
   single-choice switch (segmented buttons, status chips, a label rail) uses a
   `Select` on the phone too (`usePhone()`). Multi-choice toggles are filters.
6. **Order**: actions, search and Filters first (`order` 0), then the view
   switch or tabs (`order={1}`) nearest the thumb. The Module's own tabs have
   their own slot against the bar.
7. **Above the keyboard**: the editor's key bar stacks above the whole dock,
   never over it (`setPhoneNavHeight` measures dock and bar together).

## Why one line

Three stacked rows of chrome on a 390px screen took a fifth of it before any
content, and every extra row is something the thumb has to aim past. A select
holds any number of choices in one control's width, and a sheet holds any
number of filters behind one, so one line is nearly always enough.
