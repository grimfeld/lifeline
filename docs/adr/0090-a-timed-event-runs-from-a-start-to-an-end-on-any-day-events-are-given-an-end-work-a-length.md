---
status: accepted
supersedes: ADR 0005 (in part — "timed events are single-day")
---

# A timed Event runs from a start to an end on any day; Events are given an end, work a length

A timed Event had to start and end on the same day (ADR 0005: "timed events are single-day"). A night flight (22:00 to 06:00) or a conference (Monday 09:00 to Wednesday 17:00) could not be entered, and the Event dialog refused an End before its Start. One-off Time blockers could already run past midnight, but only as a special case of their own.

So **a timed Event runs from a start (a day and a time) to an end (a day and a time), on any day.** It stores `date` + `start` → `endDate` + `end`; `endDate` null means the same day. An all-day Event keeps `endDate` as its last day, inclusive. Events live in the documents table's fields JSON, so nothing is migrated for the shape itself. The add, move, reschedule and edit paths keep `endDate` on a timed Event, and a move shifts the end day with the start, so the length is kept.

**An Event is given an end; work is given a length.** People describe a meeting by when it starts and ends, and plan work by how long it takes. The Event form and its Peek ask for a Start and an End and show the length beside the End, never asking for it. An End earlier than the Start rolls to the next day (a pure function), so overnight needs no extra step; "Ends another day" shows the end day's Date picker for anything longer. Time blocks, Estimates and templates keep their length.

**One rule for a valid span**: the end moment (day + time) is strictly after the start moment. `spanIsValid` in Core is used by the form, the Peek, the add-event Command and so MCP's `calendar_add_event`, replacing three checks that disagreed on an end equal to the start. `calendar_add_event` takes an end day for a timed Event.

**On surfaces, an Event across days is one piece per day.** The Timed contract keeps ADR 0005's shape — one Timed item per day — and each piece now carries the whole span (`TimedItem.span`), so a view can label a cut edge and act on the whole item from any piece. One pure function splits a span: the first day from its start to the end of the day, middle days whole, the last day from midnight to its end; a span ending at 00:00 has no piece on its end day. It agrees with how Calendar subscriptions already split events. The Schedule squares and labels cut edges ("↓ Tue 06:00", "↑ from Mon 22:00"); Month and Upcoming show the Event on each day it covers, later days reading "→ 06:00"; Push sees every piece as taken.

This extends to one-off Time blockers, which gain the same `endDate`, and to the end of the stored "24:00": an end at midnight is 00:00 on the next day. Weekly blockers are unchanged — an end at or before the start still means the next morning.

## Considered options

- **A separate "overnight" flag** (an End before the Start means the next day, and nothing more): rejected. It covers the night flight but not the conference, and it puts a second, hidden meaning on the times that every reader of an Event has to know about. An end day says the same thing plainly and reaches any day.
- **Asking for a length everywhere** (an Event as start + length, like a Time block): rejected. It is how work is planned, not how anyone describes a meeting, and it makes "until 11:30" an arithmetic exercise. The length is still shown beside the End.
- **Keeping timed Events single-day, entered as several Events**: rejected. One thing in life becomes three Documents that drift apart when one is edited.

## Consequences

- ADR 0005's "timed events are single-day" no longer holds. Multi-day items still reach surfaces as one Timed item per day.
- Code reading a timed Event reads `endDate` too: an Event is on every day its span covers (`daysOf`), and "running" lasts until its end moment.
- A piece's own `start`/`end` are that day's hours ("00:00" where it carries on from the day before, "24:00" where it carries on into the next); `span` is the whole.
- Moving and resizing pieces on the Schedule, an Event counting as running until its end, one-off blockers across days and the removal of stored "24:00" land as their own changes under the same decision.
