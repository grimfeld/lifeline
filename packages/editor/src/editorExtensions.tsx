import { createRoot, type Root } from "react-dom/client";
import { Decoration, EditorView, MatchDecorator, ViewPlugin, WidgetType, type Command, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, StateField, type EditorState, type Transaction } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { extractBlocks, extractLinks, isImageEmbed, parseBlockOptions, normalizeTag, resolveAttachment, todayStr, type Attachment, type LinkIndex, type LinkRef } from "@lifeline/core";
import { DaylogBlock } from "./DaylogBlock";
import { AttachmentImage } from "./AttachmentImage";

/** The current index is pushed into the editor state so decorations can resolve links. */
export const setIndex = StateEffect.define<LinkIndex>();
export const indexField = StateField.define<LinkIndex | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setIndex)) return e.value;
    return value;
  },
});

/** Context a note's editor runs in (its own date for daylog blocks; how to open links). */
export interface EditorContext {
  docDate: string | null;
  openRef: (ref: LinkRef, name: string) => void;
  /** How to peek a link (`Ctrl+Enter`): in the Peek, whatever the link's Home Module (ADR 0085). */
  peekRef: (ref: LinkRef, name: string) => void;
}
export const setContext = StateEffect.define<EditorContext>();
export const contextField = StateField.define<EditorContext | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setContext)) return e.value;
    return value;
  },
});

/** The live Attachments, pushed in like the index, so an image embed knows whether it resolves. */
export const setAttachments = StateEffect.define<Attachment[]>();
export const attachmentsField = StateField.define<Attachment[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setAttachments)) return e.value;
    return value;
  },
});

const linkMark = (cls: string) => Decoration.mark({ class: cls });
const tagMark = Decoration.mark({ class: "cm-tag" });

/** A wikilink (Core's LINK_RE) or a prose `#tag` (Core's TAG_RE), in one pass so the two never overlap. */
const LINK_OR_TAG = new RegExp(String.raw`(!?)\[\[([^\]\n|#]+)(?:#([^\]\n|]+))?(?:\|([^\]\n]+))?\]\]|(^|[\s(])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)`, "gu");

const CODE_NODES = new Set(["FencedCode", "CodeBlock", "InlineCode"]);

/**
 * Whether `pos` is prose: not in code (where Core finds no links or tags
 * either) and, for a tag, not on an ATX heading line. Read off the syntax
 * tree, which the editor keeps incrementally, instead of re-splitting the
 * whole note into prose segments.
 */
export function proseAt(state: EditorState, pos: number, tag = false): boolean {
  for (let n: ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]> | null = syntaxTree(state).resolveInner(pos, 1); n; n = n.parent) {
    if (CODE_NODES.has(n.name)) return false;
    if (tag && n.name.startsWith("ATXHeading")) return false;
  }
  return true;
}

const linkTagMatcher = new MatchDecorator({
  regexp: LINK_OR_TAG,
  decorate(add, from, to, m, view) {
    if (m[6] !== undefined) {
      const start = from + m[5]!.length;
      if (normalizeTag(m[6]) && proseAt(view.state, start, true)) add(start, to, tagMark);
      return;
    }
    if (!proseAt(view.state, from)) return;
    const link = { embed: m[1] === "!", name: m[2]!.trim() };
    const index = view.state.field(indexField, false);
    const attachments = view.state.field(attachmentsField, false) ?? [];
    // An image embed resolves against Attachments (ADR 0037), never the Document index.
    const kind = isImageEmbed(link) ? (resolveAttachment(attachments, link.name) ? "doc" : "unresolved") : (index?.resolve(link.name).kind ?? "unresolved");
    const cls = kind === "doc" ? "cm-wikilink" : kind === "locked" ? "cm-wikilink cm-wikilink-locked" : "cm-wikilink cm-wikilink-unresolved";
    add(from, to, linkMark(cls));
  },
});

/** Whether a transaction typed or removed a code fence or backtick — code may now start or end lines away from the edit. */
function touchesCode(tr: Transaction): boolean {
  let hit = false;
  tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
    if (hit) return;
    hit = /[`~]/.test(inserted.toString()) || /[`~]/.test(tr.startState.sliceDoc(fromA, toA));
  });
  return hit;
}

/**
 * Wikilinks and tags decorated according to their resolution — over the
 * viewport only, rescanning just the changed lines on a keystroke (it used to
 * rescan the whole note on every key and every scroll).
 */
export const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = linkTagMatcher.createDeco(view);
    }
    update(u: ViewUpdate) {
      const resolution = u.transactions.some((t) => t.effects.some((e) => e.is(setIndex) || e.is(setAttachments)));
      // The parser caught up (no edit, a new tree), or code opened/closed: what is prose may have changed off the edited lines.
      const reparsed = !u.docChanged && syntaxTree(u.state) !== syntaxTree(u.startState);
      if (resolution || reparsed || u.transactions.some(touchesCode)) this.decorations = linkTagMatcher.createDeco(u.view);
      else this.decorations = linkTagMatcher.updateDeco(u, this.decorations);
    }
  },
  { decorations: (v) => v.decorations },
);

/** Cmd/Ctrl-click (or click while not focused-editing) opens a wikilink. */
export const wikilinkClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    const target = event.target as HTMLElement;
    if (!target.closest(".cm-wikilink")) return false;
    if (!(event.metaKey || event.ctrlKey)) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;
    const link = extractLinks(view.state.doc.toString()).find((l) => l.from <= pos && pos <= l.to);
    const ctx = view.state.field(contextField, false);
    const index = view.state.field(indexField, false);
    if (!link || !ctx || !index || isImageEmbed(link)) return false;
    event.preventDefault();
    ctx.openRef(index.resolve(link.name), link.name);
    return true;
  },
});

/**
 * `Ctrl+Enter` with the cursor inside a wikilink peeks its target (ADR 0085).
 * Anywhere else — and on an image embed — it declines, so the key falls
 * through to the editor's own binding (`insertBlankLine`).
 */
export const peekLinkAtCursor: Command = (view) => {
  const { state } = view;
  const pos = state.selection.main.head;
  const link = extractLinks(state.doc.toString()).find((l) => l.from < pos && pos < l.to);
  const ctx = state.field(contextField, false);
  const index = state.field(indexField, false);
  if (!link || !ctx || !index || isImageEmbed(link)) return false;
  ctx.peekRef(index.resolve(link.name), link.name);
  return true;
};

/**
 * `Ctrl+Enter` (`Cmd+Enter` too) runs `peekLinkAtCursor` ahead of the default
 * keymap, whose `Mod-Enter` inserts a blank line when it declines. A capturing
 * listener on the editor's outer box rather than a keymap: CodeMirror holds
 * Enter back on Chrome for Android before any keymap or handler sees it (and
 * replays it without its modifiers), so a keymap never fires there.
 */
export const peekLinkKey = ViewPlugin.fromClass(
  class {
    constructor(readonly view: EditorView) {
      view.dom.addEventListener("keydown", this.onKey, true);
    }
    onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.isComposing) return;
      if (!peekLinkAtCursor(this.view)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    destroy() {
      this.view.dom.removeEventListener("keydown", this.onKey, true);
    }
  },
);

/** `[[` autocomplete over every note title, alias and App target. */
export function wikilinkCompletion() {
  return autocompletion({
    override: [
      (cx: CompletionContext): CompletionResult | null => {
        const word = cx.matchBefore(/\[\[[^\]\n]*/);
        if (!word) return null;
        const index = cx.state.field(indexField, false);
        if (!index) return null;
        return {
          from: word.from + 2,
          validFor: /^[^\]\n]*$/,
          options: index.names().map((n) => ({
            label: n.name,
            detail: n.subtitle,
            type: "text",
            apply: (view, _c, from, to) => {
              const after = view.state.sliceDoc(to, to + 2) === "]]" ? "" : "]]";
              view.dispatch({ changes: { from, to, insert: n.name + after }, selection: { anchor: from + n.name.length + 2 } });
            },
          })),
        };
      },
    ],
    activateOnTyping: true,
    icons: false,
  });
}

/** Renders a `daylog` fence as a live block when the cursor is outside it. */
class DaylogWidget extends WidgetType {
  private root: Root | null = null;
  constructor(readonly date: string, readonly apps: string[] | undefined) {
    super();
  }
  override eq(other: DaylogWidget) {
    return other.date === this.date && (other.apps ?? []).join() === (this.apps ?? []).join();
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = "cm-daylog rounded-md border px-3 py-2 my-1";
    const head = document.createElement("div");
    head.className = "text-muted-foreground mb-1 text-2xs font-medium tracking-wide uppercase";
    head.textContent = `Daylog · ${this.date}`;
    el.appendChild(head);
    const body = document.createElement("div");
    el.appendChild(body);
    this.root = createRoot(body);
    this.root.render(<DaylogBlock date={this.date} apps={this.apps} compact />);
    return el;
  }
  override destroy() {
    const root = this.root;
    this.root = null;
    if (root) queueMicrotask(() => root.unmount());
  }
  override ignoreEvent() {
    return true;
  }
}

/** Whether the editor has focus — a `daylog` fence shows its source only when focused with the cursor inside. */
export const setFocused = StateEffect.define<boolean>();
export const focusedField = StateField.define<boolean>({
  create: () => false,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(setFocused)) return e.value;
    return v;
  },
});
export const focusTracking = EditorView.focusChangeEffect.of((_state, focusing) => setFocused.of(focusing));

/** The daylog blocks' widgets, where the blocks are, and which of them show their source. */
interface DaylogBlocks {
  deco: DecorationSet;
  blocks: { from: number; to: number }[];
  open: string;
}

/** The daylog blocks showing their source: the ones the cursor is in while the editor has focus. */
function openBlocks(state: EditorState, blocks: { from: number; to: number }[]): string {
  if (!(state.field(focusedField, false) ?? false)) return "";
  const sel = state.selection.main;
  return blocks
    .filter((blk) => sel.from <= blk.to && sel.to >= blk.from)
    .map((blk) => blk.from)
    .join();
}

/**
 * Block decorations must come from a StateField (not a view plugin). A cursor
 * move rebuilds them only when it enters or leaves a block — not on every move.
 */
export const daylogField = StateField.define<DaylogBlocks>({
  create: (state) => buildBlocks(state),
  update(value, tr) {
    if (tr.docChanged || tr.effects.some((e) => e.is(setContext))) return buildBlocks(tr.state);
    if ((tr.selection || tr.effects.some((e) => e.is(setFocused))) && openBlocks(tr.state, value.blocks) !== value.open) return buildBlocks(tr.state);
    return value;
  },
  provide: (f) => EditorView.decorations.from(f, (v) => v.deco),
});

function buildBlocks(state: EditorState): DaylogBlocks {
  const ctx = state.field(contextField, false);
  const b = new RangeSetBuilder<Decoration>();
  const blocks = extractBlocks(state.doc.toString()).filter((blk) => blk.lang === "daylog");
  const open = openBlocks(state, blocks);
  const shown = new Set(open ? open.split(",").map(Number) : []);
  for (const blk of blocks) {
    if (shown.has(blk.from)) continue; // cursor inside while editing: show source
    const opts = parseBlockOptions(blk.body);
    const date = opts.date || ctx?.docDate || todayStr(); // the local day, not UTC's
    const apps = opts.apps ? opts.apps.split(/[\s,]+/).filter(Boolean) : undefined;
    b.add(blk.from, blk.to, Decoration.replace({ widget: new DaylogWidget(date, apps), block: true }));
  }
  return { deco: b.finish(), blocks, open };
}

/** An embedded image shown under its `![[name.png]]` line (ADR 0037); the text stays editable above it. */
class ImageWidget extends WidgetType {
  private root: Root | null = null;
  constructor(readonly name: string) {
    super();
  }
  override eq(other: ImageWidget) {
    return other.name === this.name;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = "cm-embed-image";
    this.root = createRoot(el);
    this.root.render(<AttachmentImage name={this.name} />);
    return el;
  }
  override destroy() {
    const root = this.root;
    this.root = null;
    if (root) queueMicrotask(() => root.unmount());
  }
  override ignoreEvent() {
    return true;
  }
}

/** Block widgets for every image embed — a StateField, like the daylog blocks. */
export const imageEmbedField = StateField.define<DecorationSet>({
  create: (state) => buildImages(state),
  update(deco, tr) {
    if (!tr.docChanged) return deco;
    return affectsEmbeds(tr) ? buildImages(tr.state) : deco.map(tr.changes);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * Whether an edit can add, remove, rename or move an image embed's widget —
 * otherwise the widgets just shift with the text, and the note is not
 * rescanned for each keystroke.
 */
export function affectsEmbeds(tr: Transaction): boolean {
  let hit = false;
  tr.changes.iterChanges((fromA, toA, fromB, toB, inserted) => {
    if (hit) return;
    // Brackets, `!`, fences and line breaks make or break an embed or its line.
    const special = /[[\]!`~\n]/;
    if (special.test(inserted.toString()) || special.test(tr.startState.sliceDoc(fromA, toA))) hit = true;
    // Typing inside an embed's line (its name, say).
    else if (/!\[\[/.test(tr.state.sliceDoc(tr.state.doc.lineAt(fromB).from, tr.state.doc.lineAt(toB).to))) hit = true;
  });
  return hit;
}

function buildImages(state: EditorState): DecorationSet {
  const text = state.doc.toString();
  const b = new RangeSetBuilder<Decoration>();
  // Widgets sit at the end of the embed's line, in document order; several embeds on one line stack.
  const perLine = new Map<number, string[]>();
  for (const l of extractLinks(text)) {
    if (!isImageEmbed(l)) continue;
    const to = state.doc.lineAt(l.to).to;
    perLine.set(to, [...(perLine.get(to) ?? []), l.name]);
  }
  for (const [to, names] of [...perLine.entries()].sort((x, y) => x[0] - y[0])) {
    for (const name of names) b.add(to, to, Decoration.widget({ widget: new ImageWidget(name), block: true, side: 1 }));
  }
  return b.finish();
}
