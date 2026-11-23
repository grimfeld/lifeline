---
status: accepted
supersedes: ADR 0057 (in part — the Rail is Core's only chrome), ADR 0053 (in part — three user slots on the Phone bar), ADR 0021 (in part — the ☰ menu)
amends: ADR 0064 (in part — the phone/desk switch inside content follows the Window, while the Phone dock's move to the bottom stays the device's)
---

# The Rail becomes the Hub, a stage of Windows, and content follows its Window

ADR 0057 made the Module the thing the user opens and gave Core one narrow column, the Rail, to move between them. It still opened one Module at a time across the whole screen. On a 1920 × 1080 desk that wastes most of the screen on a layout written for one width, and it makes the question "what's on Tuesday while I do the Budget" a round trip.

So the Rail becomes the **Hub**: Core's chrome, an index of the Workspace's Modules and general Surfaces beside a **stage**, and each one opens in its own **Window** on the stage. Modules stay exactly what ADR 0057 made them, hand-written products that own their layout. What changes is the frame around them: a Module no longer owns the screen, it owns a Window.

## The shape

- **The Hub** holds a top bar (LIFELINE, the Workspace switcher, Bases, the sync badge, the date and time) and an index (the Workspace's Modules, then Calendar, Map, Graph and Screens, then Guide and Settings at the foot).
- **A Window** is a Module or a general Surface. It floats on the stage. Drag it by its bar; resize it from its corner. Drop it on an edge and it snaps to a half, near a corner to a quarter, on the top edge's middle to the whole stage (maximised). Its buttons snap it left or right, maximise or restore it, take it **full screen**, and close it. Full screen hides the Hub; Esc or "Hub" brings it back.
- **Not Windows:** Bases, the Vault, Settings, the Guide, and an App screen of no Module (the Calendar App's Events) open full screen over the Hub, and Esc closes them. Peek, Capture and the command palette stay above everything.
- **One Window per Module or Surface, for now.** Opening one already open focuses it on the route asked for. Windows are identified by their own id, which carries their Module or Surface, so several Windows of one Module can come later without a reshape.
- **Each Window keeps its own navigation.** The URL is the focused Window's route; Back and Forward act on it; a link opens or focuses its Window there.
- **The layout is per device, per Workspace.** Which Windows are open, their boxes (fractions of the stage), their order and their routes live on the device. A synced layout would carry a 1080p arrangement to a laptop where it does not fit.

## Content follows its Window, navigation follows the device

A Window can be 320px wide on a desk. So inside content the narrow/wide question is the Window's width, not the viewport's: each Window is a size container, and what used to read the viewport (`md:` classes, `usePhone()` used for layout) reads the container. Two questions that were one become two: **is this layout narrow?** (the container) and **is this a phone?** (the device). Phone navigation answers only to the second: the Phone bar, and the Phone dock's move under the thumb (ADR 0064), appear on a phone and never in a narrow desk Window, where the dock renders in place as on the desk.

In code: the kit's `ContentContainer` is a CSS size container named `content` that also hands its width to `useNarrow()`; content uses the `cq-` variants (`cq-md:`, `cq-max-md:`…), the viewport breakpoints' widths measured on that container (Tailwind's own `@md:` is another scale). `usePhone()` is the device question, for navigation only. Content portalled into `<body>` (a dialog, a popover, a Sheet) sits outside every container, so it reads its opener's container through `useNarrow()` or keeps the viewport's classes. Until Windows exist the page root is the one container, so nothing looks different.

## The phone

There are no Windows on a phone. Every destination is full screen, as before. The Phone bar becomes **Calendar · slot · ✛ · slot · Hub**: the far-right slot is fixed and opens the Hub's grid, the Workspace's Modules and Surfaces as tiles with Bases, Settings, the Guide and the Workspace switcher, and a search under the thumb. The ☰ drawer goes: a Module's own navigation is in its Phone dock tabs, and going between places is the Hub's. The user keeps two slots, down from three.

## Considered

- **A tiling grid** where every box is whole cells. Rejected for now: snap zones give the tidy arrangements without forbidding the untidy ones.
- **A synced layout.** Rejected: screens differ per device.
- **The cramped stage between 768px and a laptop's width** opening Windows maximised. Rejected for one rule: phone below 768px, Windows above.
