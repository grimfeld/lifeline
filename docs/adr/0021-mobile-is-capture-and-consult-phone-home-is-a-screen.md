# 21. Mobile is capture-and-consult; the phone home is a user Screen

Date: 2026-08-20

## Status

Accepted

## Context

Below desktop widths the app was unusable: both workspace frames hard-mount a
fixed sidebar beside `main`, no layout breakpoint existed anywhere, and the
only entry points (sidebar, Ctrl+K palette) need a pointer and a keyboard.

We could have adapted every route for phones (full parity), built a separate
mobile app, or narrowed the ambition. On a phone this app is actually used for
two things: recording something in seconds (clip, log entry, tick a chore) and
glancing at today. Dense surfaces (Schedule, week grid, Bases, Screen editing)
are desk work.

## Decision

**Mobile is a capture-and-consult subset, not parity.** Below `md` (768px) the
sidebars disappear and a bottom bar appears: **☰ · Home · Journal · +**.

- **Home is a user Screen, not a hand-written mobile page.** The user marks
  one Screen as the **phone home** (a synced `phoneHome` bool on the Screen;
  at most one holds it). On the phone its Cards render stacked in one column,
  read-only. Curation of the phone experience *is* Screen editing on the
  desktop — no second layout system.
- **Capture goes through Commands.** `CommandDef` gains `capture: true`; the
  "+" sheet lists exactly the flagged commands and opens their existing
  dialogs (full-screen below `md`). Owning Apps decide what is a capture
  command. Completing chores/tasks is not in the sheet — it's a tap in the
  due-today cards.
- **Everything else stays reachable, unadapted**, behind the ☰ drawer (the
  current workspace's sidebar in an off-canvas sheet). No "best on desktop"
  walls; dense pages simply render as they are.
- Touch ergonomics are one CSS layer: `@media (pointer: coarse)` gives
  buttons in the content area an enlarged invisible hit box.
- A minimal PWA manifest (icons, standalone display) makes it installable.
  Deliberately **no service worker** — offline shell loading is a separate
  decision; the Dexie data layer already works offline once loaded.

## Consequences

- The mobile subset is user-curated (which cards, which order) rather than
  hard-coded; new Apps join the phone by shipping cards and flagging capture
  commands — no shell changes.
- There is no mobile week view, schedule, or Base editing *by design*; the
  drawer keeps them reachable for emergencies.
- `screens.phoneHome` is synced (PB migration 1756900000), so the choice is
  made once, on the desktop, and every device agrees.
- If parity is ever wanted, it grows page-by-page (a Surface at a time)
  without touching this frame.
