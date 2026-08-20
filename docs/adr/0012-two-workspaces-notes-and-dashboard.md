# Two Workspaces — Notes and Dashboard — owned by Core

The Notes App wants Obsidian's chrome (file tree, search, tags rail; editor; links panel) and the rest of Lifeline wants a dashboard's chrome (Screens of Cards, Surfaces, App screens). Rather than one shell whose sidebar swaps per App, or per-App "full-screen modes", Core defines **Workspaces**: full-screen environments over the same data, chosen by URL — `/notes/…` is the Notes workspace, everything else the Dashboard. Core owns the switcher (segmented control at the top of each workspace's sidebar, ⌘1/⌘2, palette commands), remembers each workspace's last location, and lets an App declare which workspace its screens live in. Cross-workspace navigation is plain links, so a Journal card lands in Notes and a `[[Dune]]` wikilink lands in the Dashboard's Media screen.

## Considered options

- One shell with a swappable sidebar — rejected: the two chromes differ in more than the sidebar (three columns vs. grid; different top bars), and mixing them makes both worse.
- Per-App full-screen mode — rejected: it conflates *App* (a domain module) with *Workspace* (a way of looking at all data); the Notes workspace shows other Apps' data too (Daylog, links).
- A separate application for notes — rejected: same data, same sync, same palette; only the chrome differs.

## Consequences

- Two shell-level layouts; the sidebar, palette and routes are workspace-aware. Adding a third workspace is a layout plus a switcher entry.
- The Notes App has no entries in the Dashboard sidebar; the Dashboard reaches notes through Cards and links only. The Journal is not a separate screen but "the daily note open in the Notes workspace" with a date toolbar.
- v1 has a single editor pane; tabs/splits are additive.

## Amendment (Aug 2026)

With every Document able to carry a body (ADR 0018) the Notes workspace is renamed the **Vault** and widened: its tree, generic frontmatter+body editor, search and links panel cover every bodied Document whatever its type; the Note taker, Clipper and Writer's pad Apps put their specialised editors and App screens inside it. The Dashboard gains Bases. Two workspaces remain; the reason (two chromes that don't mix) is unchanged.
