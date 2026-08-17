import { createRoot, type Root } from "react-dom/client";
import { Decoration, EditorView, ViewPlugin, WidgetType, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder, StateEffect, StateField, type EditorState } from "@codemirror/state";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import { extractBlocks, extractLinks, extractTags, parseBlockOptions } from "../domain/markdown";
import type { LinkRef, NoteIndex } from "../domain/index";
import { DaylogBlock } from "./DaylogBlock";

/** The current index is pushed into the editor state so decorations can resolve links. */
export const setIndex = StateEffect.define<NoteIndex>();
export const indexField = StateField.define<NoteIndex | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setIndex)) return e.value;
    return value;
  },
});

/** Context a note's editor runs in (its own date for daylog blocks; how to open links). */
export interface EditorContext {
  noteDate: string | null;
  openRef: (ref: LinkRef, name: string) => void;
}
export const setContext = StateEffect.define<EditorContext>();
export const contextField = StateField.define<EditorContext | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setContext)) return e.value;
    return value;
  },
});

const linkMark = (cls: string) => Decoration.mark({ class: cls });
const tagMark = Decoration.mark({ class: "cm-tag" });

/** Wikilinks and tags decorated according to their resolution. */
export const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.transactions.some((t) => t.effects.some((e) => e.is(setIndex)))) {
        this.decorations = build(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

function build(view: EditorView): DecorationSet {
  const text = view.state.doc.toString();
  const index = view.state.field(indexField, false);
  const b = new RangeSetBuilder<Decoration>();
  const marks: { from: number; to: number; deco: Decoration }[] = [];
  for (const l of extractLinks(text)) {
    const ref = index?.resolve(l.name);
    const cls = !ref || ref.kind === "unresolved" ? "cm-wikilink cm-wikilink-unresolved" : ref.kind === "app" ? "cm-wikilink cm-wikilink-app" : "cm-wikilink";
    marks.push({ from: l.from, to: l.to, deco: linkMark(cls) });
  }
  // tags: re-scan lines for positions (extractTags gives names only)
  const tagRe = /(^|[\s(])#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;
  const known = new Set(extractTags(text));
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(text))) {
    if (!known.has(m[2].toLowerCase())) continue;
    const from = m.index + m[1].length;
    marks.push({ from, to: from + 1 + m[2].length, deco: tagMark });
  }
  marks.sort((a, c) => a.from - c.from);
  let last = -1;
  for (const mk of marks) {
    if (mk.from < last) continue;
    b.add(mk.from, mk.to, mk.deco);
    last = mk.to;
  }
  return b.finish();
}

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
    if (!link || !ctx || !index) return false;
    event.preventDefault();
    ctx.openRef(index.resolve(link.name), link.name);
    return true;
  },
});

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
            type: n.ref.kind === "app" ? "class" : "text",
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
  eq(other: DaylogWidget) {
    return other.date === this.date && (other.apps ?? []).join() === (this.apps ?? []).join();
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = "cm-daylog rounded-md border px-3 py-2 my-1";
    const head = document.createElement("div");
    head.className = "text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase";
    head.textContent = `Daylog · ${this.date}`;
    el.appendChild(head);
    const body = document.createElement("div");
    el.appendChild(body);
    this.root = createRoot(body);
    this.root.render(<DaylogBlock date={this.date} apps={this.apps} compact />);
    return el;
  }
  destroy() {
    const root = this.root;
    this.root = null;
    if (root) queueMicrotask(() => root.unmount());
  }
  ignoreEvent() {
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

/** Block decorations must come from a StateField (not a view plugin). */
export const daylogField = StateField.define<DecorationSet>({
  create: (state) => buildBlocks(state),
  update(deco, tr) {
    if (tr.docChanged || tr.selection || tr.effects.some((e) => e.is(setContext) || e.is(setFocused))) return buildBlocks(tr.state);
    return deco;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function buildBlocks(state: EditorState): DecorationSet {
  const ctx = state.field(contextField, false);
  const text = state.doc.toString();
  const b = new RangeSetBuilder<Decoration>();
  const sel = state.selection.main;
  const focused = state.field(focusedField, false) ?? false;
  for (const blk of extractBlocks(text)) {
    if (blk.lang !== "daylog") continue;
    if (focused && sel.from <= blk.to && sel.to >= blk.from) continue; // cursor inside while editing: show source
    const opts = parseBlockOptions(blk.body);
    const date = opts.date || ctx?.noteDate || new Date().toISOString().slice(0, 10);
    const apps = opts.apps ? opts.apps.split(/[\s,]+/).filter(Boolean) : undefined;
    b.add(blk.from, blk.to, Decoration.replace({ widget: new DaylogWidget(date, apps), block: true }));
  }
  return b.finish();
}
