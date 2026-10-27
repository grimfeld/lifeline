# Which editor foundation carries live preview over markdown?

Research for #370 (map #369, "a Notion-feel writing editor"). Written 2026-10-27.

**Recommendation: keep CodeMirror 6 and build live preview as our own decoration layer, the way
Obsidian does. Do not move to Milkdown or TipTap/ProseMirror.** The deciding reason is ADR 0009: a
CodeMirror document *is* the markdown text, so an untouched note cannot change and an edit
changes only the characters typed. Every ProseMirror-based option parses markdown into a tree and
re-prints the *whole* body from it, and none of the three serializers tested gets a typical
Lifeline note back byte for byte. The full reasoning, and the risks, close the page.

## What we have (the baseline)

`packages/editor` is CodeMirror 6 (`@codemirror/view` 6.43, `lang-markdown` 6.5) with:

- `MarkdownEditorImpl.tsx`: an uncontrolled `EditorView`. Text from outside comes in as a
  *minimal* change (`textDiff.ts`) annotated `external`, so it is never echoed back as a write.
- `editorExtensions.tsx`: wikilink/tag marks (`MatchDecorator` over the viewport, skipping code via
  the Lezer tree), `[[` completion (`@codemirror/autocomplete`), Cmd/Ctrl-click to open, a capturing
  `Ctrl+Enter` listener to peek (ADR 0085), `daylog` fences replaced by a React block widget unless
  the caret is inside (a `StateField`), and image embeds as React block widgets under the line.
- `mdCommands.ts`: the accessory bar's edits (`wrapWith`, `toggleBullet`, `cycleHeading`…), all
  plain text edits on markdown.
- `caretRoom.ts`: scroll margins plus a bottom tail, applied through `EditorView.scrollMargins`.
- `selection.ts`: the Selection menu (ADR 0086) reads the selection as **markdown offsets**
  (`placement: { from, to }`) and rewrites the body with `writeLink(body, placement, …)`.

The `daylog` widget is already a small live preview: the source shows only while the caret is inside.
Live preview generalises that pattern. Note also that `markdown()` is called with its default
`addKeymap: true`, which installs `insertNewlineContinueMarkup` / `deleteMarkupBackward` at
`Prec.high` (`@codemirror/lang-markdown` `dist/index.js` l. 398–424). The map's "no list
continuation on Enter" should be checked in the app: the command is installed, and may only need
fixing up rather than adding.

Since ADR 0018 the body is one field and frontmatter is a projection, so the writing Modules' editor
never sees frontmatter. Only the Vault's raw text mode does, and that mode stays plain CodeMirror
whatever is chosen here.

## The fidelity test

The same representative body (wikilinks with alias and heading, a `#tag`, `-` bullets, `__bold__`
and `_italic_`, a 4-space nested item, `1)` ordered items, an Obsidian callout `> [!note]-`, task
items, two blank lines, `snake_case`, `R&D`, `a < b`, an image embed, a `daylog` fence, a `***` rule
and a hard break) was parsed and re-serialized, without edits, by each pipeline. The script is at
`scratchpad/rt-scripts/roundtrip.mjs` (not committed). Versions: `remark-parse`/`remark-stringify` 11
(Milkdown's transformer pipeline), `prosemirror-markdown` 1.13.9, `@tiptap/markdown` 3.32.0.

| Input | remark (Milkdown's base) | prosemirror-markdown default | @tiptap/markdown 3.32 |
|---|---|---|---|
| `[[Marie Curie\|Marie]]` | `\[\[Marie Curie\|Marie]]` | `\[\[Marie Curie\|Marie\]\]` | `\[\[Marie Curie\|Marie\]\]` |
| `![[Pasted image….png]]` | `!\[\[…]]` | `!\[\[…\]\]` | `!\[\[…\]\]` |
| `- item` | `* item` | `* item` | `- item` ✓ |
| `__bold__ _italic_` | `**bold** *italic*` | `**bold** *italic*` | `**bold** *italic*` |
| 4-space nested `- item` | `  * item` | `  * item` | **item dropped** |
| `1) item` | `1. item` | `1. item` | `1. item` |
| `> [!note]- Title` + 2nd line | `> \[!note]- …` | `\[!note\]-` and the two lines **joined** into one | `> \[!note\]- …` |
| `- [ ] task` | `* \[ ] task` | `* \[ \] task` | `- [ ] task` ✓ |
| two blank lines | one | one | one |
| `snake_case R&D a < b` | `R\&D` | ✓ | `snake\_case R&amp;D a &lt; b` |
| `***` rule | ✓ | `---` | `---` |
| `daylog` fence | ✓ | ✓ | ✓ |

**None is byte-stable on an untouched note.** Custom node types fix the wikilink and callout rows
(each library has a way to add syntax), but the other rows are the serializer's own choices.

### Why this is structural, not a bug list

- **prosemirror-markdown** writes from the tree and keeps almost no source detail. The bullet comes
  from `node.attrs.bullet || "*"`, and the default schema has no `bullet` attribute. `em` is always `*`
  and `strong` always `**`. Text is escaped by `esc()` against ``/[`*\\~\[\]_]/`` (so every `[[` is
  escaped unless a custom node owns it). Blocks are joined by `closeBlock`, so blank-line runs
  collapse. Lists are tight or loose by a flag. (`src/to_markdown.ts` l. 98–150, 421, 434–440,
  commit 6b95bfe, 2026-04-01.)
- **Milkdown** stores the emphasis/strong *marker* as a mark attribute and gives it back
  (`preset-commonmark/src/mark/emphasis.ts`, `core/src/__internal__/remark-handlers.ts`), but
  `bullet_list` keeps only `spread`, not the marker (`preset-commonmark/src/node/bullet-list.ts`).
  Everything else is `remark-stringify` defaults (`core/src/internal-plugin/init.ts`). Open or recent
  issues on the same theme: backslashes in autolinks doubling on every round trip
  ([#2349](https://github.com/Milkdown/milkdown/issues/2349), upstream
  [mdast-util-to-markdown#73](https://github.com/syntax-tree/mdast-util-to-markdown/issues/73)),
  nested marks turning into literal asterisks
  ([#2403](https://github.com/Milkdown/milkdown/issues/2403)), and frontmatter unsupported
  ([#1712](https://github.com/Milkdown/milkdown/issues/1712), open).
- **TipTap's `@tiptap/markdown`** (MIT, parses with `marked` 17) is described by its own docs as "an
  early release [that] may have edge cases that may not be supported yet"
  ([tiptap.dev/docs/editor/markdown](https://tiptap.dev/docs/editor/markdown)). Its tracker has a
  string of open serializer bugs from the last weeks:
  [#8471](https://github.com/ueberdosis/tiptap/issues/8471) ("Every save changes the stored
  Markdown, even when the user did not touch that text": `olivia_rhye` → `olivia\_rhye`, `R&D` →
  `R&amp;D`), [#8134](https://github.com/ueberdosis/tiptap/issues/8134) (escaped blocks not
  preserved), [#8511](https://github.com/ueberdosis/tiptap/issues/8511) (inline code lost),
  [#8374](https://github.com/ueberdosis/tiptap/issues/8374) (links with spaces become text),
  [#7728](https://github.com/ueberdosis/tiptap/issues/7728) (invalid nesting).

All three are **parse → tree → print the whole document**. Editing one word re-prints every block,
so the first keystroke in an old note normalises all of it. That is a rewrite the user never asked
for, synced and stored as theirs, which is exactly what ADR 0009 and the vault round trip (ADR 0037,
ADR 0011) rule out. A ProseMirror editor could only avoid it with a **source-preserving layer of our
own**: map each top-level node to its source range and re-print only the blocks whose content
changed. None of the libraries offers that. It is a sizeable piece of custom, fragile code, and it
still re-normalises the block being edited.

CodeMirror has no such layer to get wrong: the state *is* the string, so fidelity holds by
construction. Live preview there only changes how the text is **drawn**: `Decoration.replace` hides
markup away from the caret, widgets draw checkboxes, bullets and rules, and line decorations style
headings and quotes. It never changes what is stored.

## Candidate by candidate

### 1. Extend CodeMirror 6 (Obsidian's approach)

- **How Obsidian does it.** "Obsidian uses CodeMirror 6 (CM6) to power the Markdown editor", and
  changing "how the document looks and feels in Live Preview" means "build an editor extension":
  view plugins and state fields ([docs.obsidian.md, Editor extensions](https://docs.obsidian.md/Plugins/Editor/Editor+extensions)).
  Live Preview "shows formatted text inline while hiding most Markdown syntax", showing the markup
  when the caret is on it; Source mode "displays all Markdown syntax exactly as written"
  ([obsidian.md/help/edit-and-read](https://obsidian.md/help/edit-and-read)). Obsidian's own Live
  Preview is closed source. The same app runs as a webview on Android and iOS (its mobile-development
  docs debug it with Chrome's and Safari's web inspectors,
  [docs.obsidian.md](https://docs.obsidian.md/Plugins/Getting+started/Mobile+development)). It is
  the strongest existence proof for the exact experience #369 wants, phone included.
- **Community live-preview extensions** are small and young; read them, don't depend on them:
  - [codemirror-rich-markdoc](https://github.com/segphault/codemirror-rich-markdoc) (MIT, ★124, last
    push Nov 2024): about 200 lines. A `ViewPlugin` walks the Lezer tree over `visibleRanges`, hides
    `EmphasisMark`/`LinkMark`/`CodeMark`/`URL` unless the caret is inside the element, and renders
    blocks. A good reference for the core loop.
  - [codemirror-live-markdown](https://github.com/blueberrycongee/codemirror-live-markdown) (MIT,
    ★44, 0.5.1-alpha.1, last push Mar 2026): modular inline marks, headings, lists, quotes, KaTeX,
    tables, code, images.
  - [ixora](https://codeberg.org/retronav/ixora) (Apache-2.0, 0.3.3, last publish Apr 2023): stale.
  - HyperMD is CodeMirror 5 and does not apply.
- **Fidelity:** byte-stable by construction (above). Callouts, wikilinks and `daylog` stay text.
  Lezer already parses `> [!note]` as a blockquote, so a callout is a decoration over it.
- **Our extensions:** none to port. Wikilink/tag marks, `[[` completion, click and peek, the
  `daylog` and image widgets, attachment drop, the Selection menu's offsets, `mdCommands`, the
  accessory bar and `caretRoom` all keep working. Live preview adds to them; one cost is making the
  wikilink mark *replace* `[[…|alias]]` with the alias off-caret, like the other markup.
- **Phone:** Chrome-for-Android Enter is the platform quirk we already handle. CM6 delays Enter and
  Backspace on Chrome Android (`delayAndroidKey`) and, since 6.x, uses the **EditContext API** on
  Android Chrome ≥ 126 (`@codemirror/view` `dist/index.js` l. 4600–4612, 7145–7150). Live preview
  adds one phone risk: replace decorations next to the caret during IME composition. Obsidian ships
  this on Android, so it is solvable, but it must be tested on a device (hide markup by *line* or
  *element* the caret is in, never mid-composition).
- **Smart typing / slash / handles:** list continuation is in `lang-markdown` (see above). A slash
  menu is an `autocompletion` source like `[[`. **Block handles are not offered**: CodeMirror has no
  block model, so a hover handle (a gutter or widget per top-level block from the Lezer tree) and the
  move-block commands are ours to build. Phone moves blocks from the accessory bar (#369), so on the
  phone that is a text-move command, which is easy. Desktop drag is the expensive part.
- **Size / health / licence:** already paid for. `@codemirror/view` is about 80 kB gzipped, and
  `lang-markdown` with its closure (state, view, language, Lezer) about 175 kB gzipped
  ([bundlephobia](https://bundlephobia.com/package/@codemirror/lang-markdown)). Already lazy
  (`MarkdownEditor.tsx` loads the impl chunk). MIT ([codemirror.net](https://codemirror.net/)),
  maintained by Marijn Haverbeke, `@codemirror/view` 6.43.15 published 2026-10-19.

### 2. Milkdown (ProseMirror + remark)

- **Fidelity:** fails the test: bullets, ordered delimiters, blank lines, `[[`, callouts and `&`
  escaping all change. It keeps emphasis markers (better than plain prosemirror-markdown). Wikilinks
  and callouts would need remark plugins plus Milkdown node schemas. Frontmatter is unsupported (#1712).
- **Our extensions:** everything is rewritten: wikilink node and parser, `[[` via `plugin-slash`
  or a tooltip, `daylog`/image as node views, drop through `plugin-upload`, every `mdCommands` edit
  as a ProseMirror command, and **the Selection menu's markdown offsets have no equivalent**
  (ProseMirror positions are tree positions; `writeLink(body, {from,to})` would need a position→source
  map that the serializer does not provide). External updates (`textDiff`) would become
  "re-parse and replace the doc", which loses selection and history unless handled carefully.
- **Phone:** ProseMirror's Android handling, the same author's older approach. It ignores Chrome
  Android's Enter `keydown` and *infers* Enter from DOM changes, synthesising a modifier-less one
  (`prosemirror-view` `src/input.ts` l. 112–115, `src/domchange.ts` l. 124–129), so **our Enter quirk
  does not go away** by switching. It does not use EditContext (no match in `prosemirror-view/src`).
  Milkdown has had Android list bugs ([#2033](https://github.com/Milkdown/milkdown/issues/2033),
  [#688](https://github.com/Milkdown/milkdown/issues/688), [#1535](https://github.com/Milkdown/milkdown/issues/1535)).
- **Slash / handles:** the best out of the box. `plugin-slash`, `plugin-block` (drag handle), and the
  Crepe build has block-edit, toolbar, link tooltip, tables and LaTeX.
- **Size / health / licence:** MIT, ★12k, very active (pushed today). `@milkdown/crepe` 7.23 is
  about **464 kB gzipped** ([bundlephobia](https://bundlephobia.com/package/@milkdown/crepe)) and
  bundles CodeMirror itself for code blocks and KaTeX. It is a single-maintainer-led project.

### 3. TipTap / ProseMirror with a markdown serializer

- **Fidelity:** fails the test and **dropped a nested list item** in our run. The official package
  calls itself early, and the open over-escaping bug (#8471) is exactly the "every save changes the
  note" failure. `prosemirror-markdown` used directly is worse on detail: it joined a callout's two
  lines into one paragraph line and rewrote `***` and bullets.
- **Our extensions:** the same full rewrite as Milkdown, including the Selection-menu offset problem.
  `@tiptap/suggestion` (MIT) gives the `[[` and `/` popups; React node views for `daylog`/image.
- **Phone:** ProseMirror's (above), plus TipTap's own open Android issues
  ([#7757](https://github.com/ueberdosis/tiptap/issues/7757) page scrolls to top while typing in a
  bottom-positioned editor, [#4606](https://github.com/ueberdosis/tiptap/issues/4606) composition,
  [#6571](https://github.com/ueberdosis/tiptap/issues/6571) toolbar and virtual keyboard). These
  are exactly where our accessory bar and `caretRoom` live.
- **Slash / handles:** `@tiptap/extension-drag-handle` is MIT in v3 (`package.json` 3.30.3), and
  `suggestion` builds a slash menu. Input rules give smart typing.
- **Size / health / licence:** MIT core, ★39k, very active. `@tiptap/core` about 37 kB gzipped,
  `starter-kit` about 106 kB, `@tiptap/markdown` about 19 kB plus `marked`
  ([bundlephobia](https://bundlephobia.com/package/@tiptap/starter-kit)). Added to, not instead of,
  CodeMirror, which the Vault's raw mode keeps.

### Others considered

Lexical (Meta) has markdown import and export through "transformers": a parse→tree→print model with
the same structural problem, and it was not evaluated further. No source-preserving
markdown-to-ProseMirror library was found.

## Scorecard

| Criterion | CodeMirror 6 + own live preview | Milkdown | TipTap / ProseMirror |
|---|---|---|---|
| Untouched note byte-stable | **Yes, by construction** | No | No |
| Editing one block leaves the rest alone | **Yes** | No (whole doc re-printed) | No (whole doc re-printed) |
| Port cost of our extensions | **None** | Full rewrite + offset mapping | Full rewrite + offset mapping |
| Android Enter quirk | Already handled; EditContext on Chrome Android | Same quirk, different shape | Same quirk + open IME/scroll bugs |
| Smart typing | List continuation shipped; rest via input handlers | Input rules | Input rules |
| Slash menu | Build on `autocompletion` (small) | Built in | `suggestion` (small) |
| Block handles / drag | **Build ourselves** (largest cost) | Built in | MIT extension |
| Live preview itself | **Build ourselves** (medium; references exist) | Native WYSIWYG | Native WYSIWYG |
| Added bundle | ~0 | ~464 kB gz (Crepe) | ~160 kB gz+ |
| Licence / health | MIT, active | MIT, active | MIT, active |

## Recommendation

**Extend CodeMirror 6.** Build live preview as a first-party decoration layer in `packages/editor`,
modelled on Obsidian's behaviour, with codemirror-rich-markdoc and codemirror-live-markdown as code
to read, not dependencies. Concretely:

1. One `StateField` (block replacements must come from a directly provided decoration set) driven by
   the Lezer tree. It hides inline markup and heading `#`s, draws bullets, checkboxes and rules as
   widgets, and styles quotes and callouts by line, revealing the source of the element (or line)
   holding the caret. `daylog` already works this way and folds into it.
2. Wikilinks render as their label off-caret, keeping click and peek.
3. Slash menu as a second `autocompletion` source. Smart typing via `lang-markdown`'s continuation
   plus `inputHandler`s.
4. Block handles last: a per-block widget or gutter from the top-level Lezer nodes, move-up/down
   commands (shared by the phone accessory bar), then desktop drag.

ProseMirror editors give WYSIWYG, a slash menu and handles for free, but they buy them by
**re-printing the user's markdown**, the one thing ADR 0009 forbids. Hiding that would take a
source-preserving layer that nobody ships. They would also make us rewrite every extension and lose
the Selection menu's offset model, without escaping the Android Enter quirk.

### Main risks of the recommendation

1. **Caret and IME at hidden ranges.** Replace decorations next to the caret can make arrow keys
   skip, make the caret jump on reveal (line height changes), or disturb Android composition.
   Mitigate: reveal per element or line, mark hidden ranges `atomicRanges` only where safe, never
   change decorations during composition, and prototype on a real Android phone and iPhone first
   (the map's bar is "typing real notes in a prototype").
2. **Block handles and drag are ours to build** with no block model underneath. It is the largest
   unknown in cost. The phone path (accessory-bar up/down) is cheap; desktop drag can ship later.
3. **Owning a live-preview layer.** It is a few hundred lines that must keep up with Lezer's
   markdown tree and our widgets (scroll anchoring with React block widgets; `caretRoom` margins with
   varying line heights). It is maintained in-house rather than by a vendor.
4. **"Notion feel" ceiling.** A text editor with hidden markup is Obsidian-feel, not pixel-identical
   Notion: selecting across a hidden marker, or Backspace at a heading start, edits markdown
   characters. Each such seam needs a deliberate command (e.g. Backspace at a heading's start removes
   the `#`s). Budget for a polish pass of these.
