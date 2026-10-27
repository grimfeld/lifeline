// PROTOTYPE for #372 — throwaway, never merged.
//
// Live preview as a decoration layer over the markdown text (research for #370):
// the doc string is never rewritten here. Markup is hidden with replace
// decorations and drawn with widgets (bullets, checkboxes, rules); headings,
// quotes and fences are styled by line. The four reveal variants share all of
// this and differ only in when a hidden marker shows (`revealer`).

import { StateField, type EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { ensureSyntaxTree, syntaxTree } from "@codemirror/language";
import { focusedField, setFocused } from "./editorExtensions";
import { variantFacet, type Variant } from "./variant.prototype";

type Tree = ReturnType<typeof syntaxTree>;
type Node = ReturnType<Tree["resolveInner"]>;

/** A hidden range, with the element, line and block that reveal it. */
interface Hide {
  from: number;
  to: number;
  deco: Decoration;
  /** The element the marker belongs to (variant A). */
  elFrom: number;
  elTo: number;
  /** The block holding it (variant C), as `from-to`. */
  block: string;
  /** A line class to add only while hidden (a fence line shrinks). */
  hiddenLineClass?: string;
}

const BLOCKS = new Set(["ListItem", "FencedCode", "CodeBlock", "HorizontalRule", "Table", "HTMLBlock", "Blockquote"]);

/** The block a node sits in: list item, heading, fence, quote/callout, or a top-level paragraph. */
function blockOf(node: Node | null): Node | null {
  for (let n = node; n; n = n.parent) {
    if (BLOCKS.has(n.name) || /^(ATX|Setext)Heading/.test(n.name)) return n;
    if (n.name === "Paragraph" && n.parent?.name === "Document") return n;
  }
  return null;
}
const blockKey = (n: Node | null) => (n ? `${n.from}-${n.to}` : "");

/** The block of a line: read at its first non-space character, so a nested item is its own block. */
function lineBlock(state: EditorState, tree: Tree, lineNo: number): string {
  const line = state.doc.line(lineNo);
  const indent = /^\s*/.exec(line.text)![0].length;
  if (indent === line.length) return "";
  return blockKey(blockOf(tree.resolveInner(line.from + indent, 1)));
}

class BulletWidget extends WidgetType {
  override eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-bullet";
    el.textContent = "•";
    return el;
  }
}

/** Flip the `[ ]`/`[x]` at or after `pos` on its line — a plain text edit, so undo has it. */
function toggleTaskAt(view: EditorView, pos: number) {
  const line = view.state.doc.lineAt(pos);
  const at = line.text.slice(pos - line.from).search(/\[[ xX]\]/);
  if (at < 0) return;
  const inner = pos + at + 1;
  const checked = view.state.sliceDoc(inner, inner + 1) !== " ";
  view.dispatch({ changes: { from: inner, to: inner + 1, insert: checked ? " " : "x" }, userEvent: "input" });
}

class CheckboxWidget extends WidgetType {
  constructor(readonly checked: boolean) {
    super();
  }
  override eq(other: CheckboxWidget) {
    return other.checked === this.checked;
  }
  toDOM(view: EditorView) {
    const el = document.createElement("span");
    el.className = "cm-lp-check" + (this.checked ? " is-checked" : "");
    el.setAttribute("role", "checkbox");
    el.setAttribute("aria-checked", String(this.checked));
    el.textContent = this.checked ? "✓" : "";
    // Taking the press keeps the caret (and the phone keyboard) where it was.
    el.addEventListener("mousedown", (e) => e.preventDefault());
    el.addEventListener("click", (e) => {
      e.preventDefault();
      toggleTaskAt(view, view.posAtDOM(el));
    });
    return el;
  }
  override ignoreEvent() {
    return true;
  }
}

class RuleWidget extends WidgetType {
  override eq() {
    return true;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-hr";
    return el;
  }
}

class FenceWidget extends WidgetType {
  constructor(readonly label: string) {
    super();
  }
  override eq(other: FenceWidget) {
    return other.label === this.label;
  }
  toDOM() {
    const el = document.createElement("span");
    el.className = "cm-lp-fence-label";
    el.textContent = this.label;
    return el;
  }
}

const hideDeco = Decoration.replace({});
const bullet = Decoration.replace({ widget: new BulletWidget() });
const rule = Decoration.replace({ widget: new RuleWidget() });
const line = (cls: string) => Decoration.line({ class: cls });
const linkMark = Decoration.mark({ class: "cm-lp-link" });

const WIKILINK = /(!?)\[\[([^\]\n|#]+)(?:#([^\]\n|]+))?(?:\|([^\]\n]+))?\]\]/g;
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?=\r?\n|$)/;

interface Built {
  deco: DecorationSet;
  /** The hidden ranges, atomic for the caret in variant D. */
  atomic: DecorationSet;
}

function build(state: EditorState): Built {
  const tree = ensureSyntaxTree(state, state.doc.length, 50) ?? syntaxTree(state);
  const doc = state.doc;
  const hides: Hide[] = [];
  const lines: Range<Decoration>[] = [];
  const always: Range<Decoration>[] = [];
  const addLines = (from: number, to: number, cls: string) => {
    for (let l = doc.lineAt(from).number, end = doc.lineAt(to).number; l <= end; l++) lines.push(line(cls).range(doc.line(l).from));
  };

  // Frontmatter: always hidden (the writing Modules never show it anyway, ADR 0018).
  let fmEnd = -1;
  const fm = FRONTMATTER.exec(doc.sliceString(0, Math.min(doc.length, 20000)));
  if (fm) {
    fmEnd = fm[0].length;
    always.push(Decoration.replace({ block: true }).range(0, fmEnd));
  }

  tree.iterate({
    enter(ref) {
      if (ref.from < fmEnd) return ref.name === "Document";
      const node = ref.node;
      const name = ref.name;
      const block = () => blockKey(blockOf(node));
      const heading = /^ATXHeading(\d)$/.exec(name);
      if (heading) {
        lines.push(line(`cm-lp-h cm-lp-h${heading[1]}`).range(doc.lineAt(ref.from).from));
        for (let c = node.firstChild; c; c = c.nextSibling) {
          if (c.name !== "HeaderMark") continue;
          // The opening `#`s take their space; a closing run takes the space before it.
          const opening = c.from === ref.from;
          const from = opening ? c.from : Math.max(ref.from, c.from - 1);
          const to = opening ? Math.min(ref.to, c.to + 1) : c.to;
          hides.push({ from, to, deco: hideDeco, elFrom: ref.from, elTo: ref.to, block: blockKey(node) });
        }
        return;
      }
      switch (name) {
        case "Emphasis":
        case "StrongEmphasis":
        case "Strikethrough":
        case "InlineCode": {
          const b = block();
          for (let c = node.firstChild; c; c = c.nextSibling) {
            if (c.name === "EmphasisMark" || c.name === "StrikethroughMark" || c.name === "CodeMark") hides.push({ from: c.from, to: c.to, deco: hideDeco, elFrom: ref.from, elTo: ref.to, block: b });
          }
          return name === "InlineCode" ? false : undefined;
        }
        case "Link": {
          const marks = [];
          let url = false;
          for (let c = node.firstChild; c; c = c.nextSibling) {
            if (c.name === "LinkMark") marks.push(c);
            if (c.name === "URL") url = true;
          }
          const close = marks.find((m) => doc.sliceString(m.from, m.to) === "]");
          if (!url || !marks[0] || !close || doc.sliceString(marks[0].from, marks[0].to) !== "[") return;
          const b = block();
          hides.push({ from: marks[0].from, to: marks[0].to, deco: hideDeco, elFrom: ref.from, elTo: ref.to, block: b });
          hides.push({ from: close.from, to: ref.to, deco: hideDeco, elFrom: ref.from, elTo: ref.to, block: b });
          if (close.from > marks[0].to) always.push(linkMark.range(marks[0].to, close.from));
          return;
        }
        case "ListItem": {
          const mark = node.getChild("ListMark");
          if (!mark) return;
          const ordered = node.parent?.name === "OrderedList";
          const task = node.getChild("Task")?.getChild("TaskMarker");
          if (task) {
            const checked = doc.sliceString(task.from + 1, task.from + 2) !== " ";
            const from = ordered ? task.from : mark.from;
            const to = Math.min(doc.lineAt(task.from).to, task.to + 1);
            hides.push({ from, to, deco: Decoration.replace({ widget: new CheckboxWidget(checked) }), elFrom: from, elTo: task.to, block: blockKey(node) });
            if (checked) lines.push(line("cm-lp-done").range(doc.lineAt(task.from).from));
          } else if (!ordered) {
            hides.push({ from: mark.from, to: mark.to, deco: bullet, elFrom: mark.from, elTo: mark.to, block: blockKey(node) });
          }
          return;
        }
        case "Blockquote": {
          const first = doc.lineAt(ref.from);
          const callout = /^\s*(?:>\s?)+\[!\w+\][-+]?/.test(first.text);
          // Nested quotes: only the outermost draws the rule.
          if (node.parent && blockOf(node.parent)?.name === "Blockquote") return;
          addLines(ref.from, ref.to, callout ? "cm-lp-quote cm-lp-callout" : "cm-lp-quote");
          if (callout) lines.push(line("cm-lp-callout-title").range(first.from));
          return;
        }
        case "QuoteMark": {
          const to = doc.sliceString(ref.to, ref.to + 1) === " " ? ref.to + 1 : ref.to;
          hides.push({ from: ref.from, to, deco: hideDeco, elFrom: ref.from, elTo: ref.to, block: block() });
          return;
        }
        case "HorizontalRule": {
          lines.push(line("cm-lp-hr-line").range(doc.lineAt(ref.from).from));
          hides.push({ from: ref.from, to: ref.to, deco: rule, elFrom: ref.from, elTo: ref.to, block: blockKey(node) });
          return false;
        }
        case "FencedCode": {
          const info = node.getChild("CodeInfo");
          const lang = info ? doc.sliceString(info.from, info.to).trim() : "";
          if (lang === "daylog") return false; // the daylog widget owns these
          addLines(ref.from, ref.to, "cm-lp-code");
          const first = doc.lineAt(ref.from);
          const last = doc.lineAt(ref.to);
          const key = blockKey(node);
          lines.push(line("cm-lp-code-first").range(first.from));
          hides.push({ from: first.from, to: first.to, deco: Decoration.replace({ widget: new FenceWidget(lang) }), elFrom: first.from, elTo: first.to, block: key, hiddenLineClass: "cm-lp-fence-edge" });
          const marks = node.getChildren("CodeMark");
          if (marks.length > 1 && last.number > first.number) {
            lines.push(line("cm-lp-code-last").range(last.from));
            hides.push({ from: last.from, to: last.to, deco: hideDeco, elFrom: last.from, elTo: last.to, block: key, hiddenLineClass: "cm-lp-fence-edge" });
          }
          return false;
        }
        case "CodeBlock":
        case "HTMLBlock":
        case "Table":
          return false;
      }
      return undefined;
    },
  });

  // Wikilinks show their label only: `[[Target#Heading|Alias]]` reads "Alias".
  const text = doc.sliceString(Math.max(0, fmEnd));
  const base = Math.max(0, fmEnd);
  for (const m of text.matchAll(WIKILINK)) {
    if (m[1]) continue; // image embeds stay raw, their widget draws below
    const from = base + m.index;
    const to = from + m[0].length;
    const inner = tree.resolveInner(from, 1);
    if (/Code|CodeText|CodeBlock|FencedCode/.test(inner.name) || inner.parent?.name === "InlineCode") continue;
    const b = blockKey(blockOf(inner));
    const labelFrom = m[4] ? to - 2 - m[4].length : from + 2;
    hides.push({ from, to: labelFrom, deco: hideDeco, elFrom: from, elTo: to, block: b });
    hides.push({ from: to - 2, to, deco: hideDeco, elFrom: from, elTo: to, block: b });
  }

  const revealed = revealer(state, tree);
  const out: Range<Decoration>[] = [...always, ...lines];
  const atomic: Range<Decoration>[] = [];
  const variant = state.facet(variantFacet);
  for (const h of hides) {
    if (h.from >= h.to && !h.hiddenLineClass) continue;
    if (revealed(h)) continue;
    if (h.to > h.from || h.deco !== hideDeco) out.push(h.deco.range(h.from, h.to));
    if (h.hiddenLineClass) out.push(line(h.hiddenLineClass).range(doc.lineAt(h.from).from));
    if (variant === "D" && h.to > h.from) atomic.push(hideDeco.range(h.from, h.to));
  }
  return { deco: Decoration.set(out, true), atomic: Decoration.set(atomic, true) };
}

/**
 * The four variants, which are the point of the prototype. They differ only here:
 * A the element the caret touches, B every marker on the caret's lines, C every
 * marker of the caret's blocks, D never. Off focus nothing is revealed.
 */
function revealer(state: EditorState, tree: Tree): (h: Hide) => boolean {
  const variant: Variant = state.facet(variantFacet);
  const focused = state.field(focusedField, false) ?? false;
  if (variant === "D" || !focused) return () => false;
  const ranges = state.selection.ranges;
  if (variant === "A") return (h) => ranges.some((r) => r.from <= h.elTo && r.to >= h.elFrom);
  const lineNos = new Set<number>();
  for (const r of ranges) for (let l = state.doc.lineAt(r.from).number, end = state.doc.lineAt(r.to).number; l <= end; l++) lineNos.add(l);
  if (variant === "B") return (h) => lineNos.has(state.doc.lineAt(h.from).number) || lineNos.has(state.doc.lineAt(h.to).number);
  const blocks = new Set<string>();
  for (const l of lineNos) {
    const k = lineBlock(state, tree, l);
    if (k) blocks.add(k);
  }
  return (h) => blocks.has(h.block);
}

const livePreviewField = StateField.define<Built>({
  create: build,
  update(value, tr) {
    // Never redraw under an IME composition: map what is there and catch up after.
    if (tr.isUserEvent("input.type.compose")) return { deco: value.deco.map(tr.changes), atomic: value.atomic.map(tr.changes) };
    const rebuild =
      tr.docChanged ||
      tr.selection ||
      tr.effects.some((e) => e.is(setFocused)) ||
      tr.startState.facet(variantFacet) !== tr.state.facet(variantFacet) ||
      syntaxTree(tr.startState) !== syntaxTree(tr.state);
    return rebuild ? build(tr.state) : value;
  },
  provide: (f) => [EditorView.decorations.from(f, (v) => v.deco), EditorView.atomicRanges.of((view) => view.state.field(f).atomic)],
});

/** Cmd/Ctrl-click on a rendered link opens its URL. */
const linkClick = EditorView.domEventHandlers({
  mousedown(event, view) {
    if (!(event.metaKey || event.ctrlKey) || !(event.target as HTMLElement).closest(".cm-lp-link")) return false;
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) return false;
    for (let n: Node | null = syntaxTree(view.state).resolveInner(pos, 1); n; n = n.parent) {
      if (n.name !== "Link") continue;
      const url = n.getChild("URL");
      if (!url) return false;
      event.preventDefault();
      window.open(view.state.sliceDoc(url.from, url.to), "_blank", "noopener");
      return true;
    }
    return false;
  },
});

const theme = EditorView.baseTheme({
  ".cm-lp-h": { fontWeight: "600" },
  ".cm-lp-h1": { paddingTop: "0.6em !important" },
  ".cm-lp-h2": { paddingTop: "0.45em !important" },
  ".cm-lp-h3": { paddingTop: "0.3em !important" },
  ".cm-lp-bullet": { display: "inline-block", width: "0.7em", color: "var(--muted-foreground)", fontWeight: "700" },
  ".cm-lp-check": {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "1.05em",
    height: "1.05em",
    marginRight: "0.4em",
    verticalAlign: "-0.15em",
    border: "1.5px solid var(--muted-foreground)",
    borderRadius: "0.25em",
    fontSize: "0.85em",
    lineHeight: "1",
    cursor: "pointer",
    userSelect: "none",
  },
  ".cm-lp-check.is-checked": { background: "var(--primary)", borderColor: "var(--primary)", color: "var(--primary-foreground)" },
  ".cm-lp-done": { color: "var(--muted-foreground)", textDecoration: "line-through" },
  ".cm-lp-quote": { borderLeft: "3px solid var(--border)", paddingLeft: "0.75rem !important", color: "var(--muted-foreground)" },
  ".cm-lp-callout": { borderLeftColor: "var(--primary)", background: "color-mix(in oklab, var(--primary) 7%, transparent)" },
  ".cm-lp-callout-title": { fontWeight: "600" },
  ".cm-lp-hr": { display: "inline-block", width: "100%", verticalAlign: "middle", borderTop: "1px solid var(--border)" },
  ".cm-lp-link": { color: "var(--primary)", textDecoration: "underline", cursor: "pointer" },
  ".cm-lp-code": {
    fontFamily: "ui-monospace, monospace",
    fontSize: "0.9em",
    background: "color-mix(in oklab, var(--muted) 55%, transparent)",
    paddingLeft: "0.75rem !important",
  },
  ".cm-lp-code-first": { borderTopLeftRadius: "0.375rem", borderTopRightRadius: "0.375rem" },
  ".cm-lp-code-last": { borderBottomLeftRadius: "0.375rem", borderBottomRightRadius: "0.375rem" },
  ".cm-lp-fence-edge": { fontSize: "0.65em", lineHeight: "1.3" },
  ".cm-lp-fence-label": { color: "var(--muted-foreground)" },
});

export function livePreview(): Extension {
  return [livePreviewField, linkClick, theme];
}
