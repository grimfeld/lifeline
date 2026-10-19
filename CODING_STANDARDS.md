# Coding standards

Read at review time. Rules marked **(check)** are also enforced by `scripts/check-ui.mjs`
on the lines a change adds; a reviewer spends attention on the rest. A documented
decision in `docs/adr/` outranks anything here.

## General

- **Neighbours.** New code reads like the code around it: comment density, naming, JSX
  layout (dense one-line props), import shape. The repo runs no formatter — match by eye.
- **Vocabulary.** Identifiers, comments and every string a person sees use the terms in
  `CONTEXT.md`; a term's _Avoid_ list is binding ("an option its Choice doesn't offer",
  never "a choice its options don't offer").
- **ADRs.** A diff that contradicts an ADR is a finding, even when the code works: change
  the code, or the ADR in the same change.

## UI

The app is built from `@lifeline/ui` — shadcn/ui components on Tailwind CSS v4 — and the
tokens in `packages/ui/src/styles/globals.css` (ADR 0079). Phone layout is ADR 0064, long
content ADR 0065 (both summarised in `CLAUDE.md`).

Kit pieces marked _coming_ are specified but not built yet; until they land, use the
nearest existing pattern and don't hand-roll a new one.

### Components

- **(check)** Import UI from `@lifeline/ui`, never `radix-ui`, `sonner`, `cmdk` directly.
- A control the kit has is used from the kit: `Button`, `Input`, `Select`, `Checkbox`,
  `Textarea`, `Dialog`, `Sheet`, `Popover`, `DropdownMenu`, `Tabs`, `Badge`, `Card`.
  A raw `<button>` is fine for a whole row or tile that acts as one (it gets
  `type="button"` and a `focus-visible:` style).
- Single-choice switches (segments, status chips, shelf pickers) use `ToggleGroup`
  (_coming_): it looks like `TabsList` and becomes a `Select` on a phone by itself.
- Search-as-you-type pickers use `Combobox` (_coming_, `Command` + `Popover`), never a
  hand-rolled `role="listbox"`.
- **(check)** Tooltips use `Tooltip` (`<Tip label>` for an icon Button); `title=` is not a
  tooltip. It shows on the desk only, never on touch; the Button keeps its `aria-label`.
- A component copied between apps belongs in `packages/parts`.

### Colour

- **(check)** Colour comes from tokens: `text-muted-foreground`, `bg-accent`,
  `text-destructive`, `text-success`, `text-warning` (and `bg-`/`border-` forms,
  `*-foreground` for text on a filled background). No palette classes
  (`text-amber-600`, `bg-emerald-500`), no arbitrary colours (`bg-[#…]`,
  `bg-[var(--chart-…)]`).
- **(check)** A colour a Document chooses is a slot: `bg-slot-blue`, `text-slot-red`…, or
  `colorVar(slot)` when the slot is data. Hearts are `text-slot-red`, star ratings
  `text-slot-yellow`.
- White or black text over a cover image is the one palette exception; mark it
  `ui-allow: raw-colour — over a cover image`.
- Dark mode is the tokens' job; `dark:` variants only patch something the tokens can't.

### Type

- **(check)** Sizes come from the scale: `text-2xs` (10px — badges, counts, axis ticks),
  `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`; `text-3xl`/`4xl`
  for big display numbers only. No `text-[11px]`.
- **(check)** A page title is `PageHeader` (`text-xl font-semibold tracking-tight`); no
  `<h1>` outside the kit.
- A section heading is sentence case, `text-sm font-medium text-muted-foreground` — no
  uppercase eyebrows.
- Weights: `font-medium` by default, `font-semibold` for titles; numbers that line up get
  `tabular-nums`. Ellipsis is "…".

### Sizes

- **(check)** Kit controls are sized by their props, never by a `size-*`/`h-*` class:
  Button `size` = `default` `sm` `xs` `lg` `icon` `icon-sm` `icon-xs` `icon-lg`;
  `SelectTrigger size="sm"`; `Input` is `h-8` already.
- Icons are `size-3`, `size-3.5` or `size-4` (`size-5` in big tiles); an icon inside a
  `Button` needs no class.
- Spacing stays on the scale (`gap-1` … `gap-6`); arbitrary lengths only for a real
  measurement (a chart, a grid track), with the reason in a comment.

### Icons

- lucide-react only, imported without the `Icon` suffix.
- **(check)** Every icon-only `Button` has an `aria-label` (a raw icon `<button>` too).
  `title` alone is not a label.

### Layout

- **(check)** The layout switches at `md` — the phone line (ADR 0064). `sm:` is only for
  dialog widths (`sm:max-w-md`).
- **(check)** The phone hook is `usePhone()` from `@lifeline/ui`; `useIsMobile` is
  deprecated.
- A page is `Page`: `mx-auto grid w-full gap-4 p-4 md:p-6`, `width="reading"`
  (max-w-3xl, default) or `"wide"` (max-w-6xl). Its title row is `PageHeader` (title +
  actions), an empty list `EmptyState` (message + optional `action`).
- Boxes are `rounded-lg border`; a Card is `Card`. Hover is `hover:bg-accent`.

### Deleting

- **(check)** No `window.confirm`, `prompt` or `alert`.
- Delete at once and offer **Undo** in the toast (`toast.success("Deleted", { action:
  { label: "Undo", onClick } })`) — Documents are soft-deleted, so Undo always works.
- Confirm only what Undo can't bring back — an empty type, a Workspace, something outside
  Lifeline — with one `AlertDialog` (_coming_). No two-tap "Really delete" buttons.
- A destructive action is `variant="destructive"` (a `DropdownMenuItem` too), not
  `className="text-destructive"` on another variant.

### Dialogs

- Every `DialogContent` has a `DialogDescription` — visible, or `className="sr-only"`.
- Widths: `sm:max-w-md` by default, `sm:max-w-lg` for a wide form, `2xl` and up only for
  a full editor.
- Editors and forms are Dialogs (full screen on a phone already); navigation drawers and
  phone bottom sheets are Sheets; a desk-only floating picker is a Popover with a Sheet on
  the phone.

### Forms and feedback

- A field is `Field` (Label, control, hint, error): `<Field label="Title" error={…}><Input/></Field>`.
- A field's error shows under it, with `aria-invalid` on the control — not in a toast.
  Disabling submit until the form is valid is fine.
- Toasts report what an action did: `toast.success` / `toast.error`, with a sentence a
  person understands rather than a raw `Error.message` alone.

### Classes

- **(check)** Compose classes with `cn()`, never a template literal.
- Order inside a class string: colour token first, then layout, then the rest — as the
  code already does.
- `style={{…}}` only for values computed at runtime (a slot from data, a measured width).
