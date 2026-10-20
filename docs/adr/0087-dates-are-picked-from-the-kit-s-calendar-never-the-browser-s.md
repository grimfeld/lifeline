---
status: accepted
---

# Dates are picked from the kit's calendar, never the browser's

Every date was a native `<input type="date">`. Each browser draws it its own way: Chrome on the desk shows a typed `mm/dd/yyyy` mask and a small popup, iOS a wheel, Android a dialog, and Firefox something else again. None of them looks like the rest of Lifeline, none starts the week on Monday as the Week view does, and the empty field reads `mm/dd/yyyy` rather than saying there is no date. The same Peek looked different on the phone and on the desk.

So **a day is picked from the kit's own calendar**. `@lifeline/ui` has shadcn's `Calendar` (react-day-picker) and a field-style `DatePicker`: a button showing the day ("Tue 20 Oct 2026", in the browser's locale) that opens the calendar in a popover. Picking a day closes it and writes at once; Escape backs out with nothing changed. The week starts on Monday; month and day names come from the browser. The header has month and year dropdowns from 1900 to ten years ahead (`startYear`/`endYear` widen it, for historical dates). Days outside `min`/`max` are disabled, "Today" shows when today may be picked, and an optional date has "Clear" and reads a muted "No date" when empty; a `required` one can't be cleared.

The value in and out is still the `YYYY-MM-DD` string the native input gave (`""` for none), converted to and from a `Date` in local time, so nothing stored changes. `CommitField` with `type="date"` renders the `DatePicker`, so every Peek's dates switch over without touching the call sites.

## Considered options

- **Native everywhere** (keep `<input type="date">`): rejected. It is the problem: a different control on every browser, Sunday-first weeks in en-US, a typed mask that reads as an error when empty, and no way to show "No date" or offer "Clear" and "Today" consistently.
- **Native on the phone only, the kit's calendar on the desk**: rejected. The phone's wheels and dialogs are fine on their own, but the same Peek would then work two different ways, and phone and desk are meant to look the same (ADR 0064). Two controls also mean two sets of e2e steps.
- **A typeable field** (type the date, with the calendar as a helper): rejected for now. Parsing typed dates in every locale is its own project, and picking is what is done almost every time. It can come later on top of the same `DatePicker`.

## Consequences

- **Times stay native for now.** `<input type="time">` (an Event's start and end, a Time blocker) and the time half of `datetime-local` are left alone; a date-and-time field is its own change.
- Radix `PopoverContent` is `role="dialog"`, so while a picker is open over a Peek or a Dialog, `getByRole("dialog")` in e2e is ambiguous. Tests pick dates with the shared helper `shell/e2e/support/date-picker.ts` (`pickDate`), which scopes to the calendar.
- The kit depends on `react-day-picker` (and through it `date-fns`); apps don't.
