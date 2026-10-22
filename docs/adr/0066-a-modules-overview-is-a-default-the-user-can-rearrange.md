---
status: accepted
amends: ADR 0049 (in part — a Module lands on its Overview), ADR 0053 (in part — a Module's home may be its Overview), ADR 0057 (a Module's landing page of Cards)
---

# A Module's Overview is a default the user can rearrange

> Amends ADR 0057. Its point stands: the Module is hand-written, and the user is
> never handed a blank grid. What changes is that a Module's landing page made of
> Cards is no longer fixed.

Four Modules already land on a page of App Cards: Money, House, Culture and
Progress. Each page is a fixed arrangement in code. ADR 0057 kept them fixed
because Screens were not used: a blank grid hands the user the design work. But
a fixed page is not right for everyone either. The user wants to move, add and
drop Cards on the page they open every day.

## Decision

A Module may declare an **Overview**: its landing page, as Card instances on the
Screen grid. The Module writes the **default** by hand, and the user rearranges
it.

- **Opt-in.** Money, House, Culture and Progress declare one. The Vault, Mail and
  Languages don't. They land on one page that is not a page of Cards.
- **Per Workspace.** Like Screens, each Workspace has its own arrangement.
- **The arrangement starts lazily.** An Overview nobody has edited follows the
  Module's default as it changes in code. The first edit makes the arrangement
  the user's own, and it never changes by itself after that. **Reset to default**
  drops the user's copy.
- **It is not a Screen.** It can't be named, created or deleted, and it isn't
  listed under Screens. It exists exactly when its Module is in the Workspace. It
  shares the grid, the editing (on the desk and on the phone) and the card picker
  with Screens. The picker offers every Card and lists the Module's own Apps'
  Cards first: Modules scope chrome, never what the user is able to place.
- **Cards are not scoped.** A Card behaves exactly as it does on a Screen.
  Scoping to the Module's types is a concern of an embedded Surface, not of a
  Card.
- **A Card instance may carry its own title**, on Screens and Overviews alike
  ("What's left" for Pocket's Allowances). The default sets it, and the user can
  edit it.
- **Lifecycle.** If a Module leaves a Workspace, its arrangement is kept, ready
  for when the Module comes back. Deleting a Workspace deletes its Overviews'
  arrangements; they are not moved to the fallback Workspace the way Screens are.
  An Overview may be emptied by the user, but is never created empty.

## Considered options

- **A fixed page with one user card zone.** Rejected because it adds two kinds of
  region to every overview, and the zone is just a small Screen.
- **A Screen claims the Module again** (the retired Module screen, ADR 0049).
  Rejected because it brings back the blank grid that 0057 removed, and because a
  deletable, renamable Screen as a Module's landing page leaves the Module
  without one.

## Consequences

- Projects lands on a list/board of Projects that isn't made of Cards. Whether it
  becomes an Overview is a separate decision.
- `UserScreen.module`, which ADR 0049 used to let a Screen claim a Module, is
  unread today. It must not be revived to mean "this is an Overview".

## Amendment (2026-10-22): Mail and Languages are gone

Mail is retired (ADR 0080), Languages is now the Knowledge Module (ADR 0073), and the Vault is no longer a Module but the raw editor (ADR 0068).
