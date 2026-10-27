// PROTOTYPE for #372 — throwaway, never merged.
//
// The nine smart typing rules settled in #371, the same in every reveal variant.
// Every rule is a plain text edit on the markdown, so undo has each one.
//
//  1. Enter: lang-markdown's stock `insertNewlineContinueMarkup` (already on).
//  2. Shift-Enter: a new line in the same block, indented under the item's text.
//  3. Tab / Shift-Tab: nest / un-nest a list item with its children; indent in a
//     fence; nothing anywhere else.
//  4. Backspace at a block's text start: drop the marker (keep the indent), then join.
//  5. `[] ` / `[ ] ` at a line start becomes `- [ ] `; ``` + Enter closes the fence.
//  6. Pair ( [ { and backticks, never in code; typing a wrap char over a selection wraps it.
//  7. Mod chords: B I E Shift-S K, Shift-7/8/9 lists, Alt-1/2/3 headings.
//  8. Paste: rich HTML → markdown (turndown, lazy); Mod-Shift-V plain.
//  9. Phone: the same rules; no new accessory-bar keys.

import { EditorSelection, EditorState, Prec, type ChangeSpec, type Extension } from "@codemirror/state";
import { EditorView, keymap, type Command } from "@codemirror/view";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { indentLess, indentMore, isolateHistory } from "@codemirror/commands";
import { getIndentUnit, syntaxTree } from "@codemirror/language";
import { proseAt } from "./editorExtensions";
import { wrapWith } from "./mdCommands";
import { getVariant } from "./variant.prototype";

type Node = ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]>;

function ancestor(state: EditorState, pos: number, name: string, side: -1 | 1 = 1): Node | null {
  for (let n: Node | null = syntaxTree(state).resolveInner(pos, side); n; n = n.parent) if (n.name === name) return n;
  return null;
}

const inFence = (state: EditorState, pos: number) => !!(ancestor(state, pos, "FencedCode", 1) ?? ancestor(state, pos, "FencedCode", -1));

/** Line edits that keep a selection over the lines they touched (as mdCommands does). */
function dispatchLines(view: EditorView, changes: ChangeSpec[]) {
  if (!changes.length) return;
  const set = view.state.changes(changes);
  const { ranges, mainIndex } = view.state.selection;
  const selection = EditorSelection.create(
    ranges.map((r) => (r.empty ? EditorSelection.cursor(set.mapPos(r.head, 1)) : EditorSelection.range(set.mapPos(r.from, -1), set.mapPos(r.to, 1)))),
    mainIndex,
  );
  view.dispatch({ changes: set, selection, userEvent: "input", scrollIntoView: true });
}

function selectedLines(state: EditorState) {
  const seen = new Map<number, ReturnType<EditorState["doc"]["lineAt"]>>();
  for (const r of state.selection.ranges) {
    for (let l = state.doc.lineAt(r.from).number, end = state.doc.lineAt(r.to).number; l <= end; l++) {
      const line = state.doc.line(l);
      seen.set(line.from, line);
    }
  }
  return [...seen.values()].sort((a, b) => a.from - b.from);
}

// ── 2. Shift-Enter ─────────────────────────────────────────────────────────

const ITEM = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?/;

const softBreak: Command = (view) => {
  const { state } = view;
  view.dispatch(
    state.changeByRange((r) => {
      const line = state.doc.lineAt(r.from);
      const item = ITEM.exec(line.text);
      const indent = item ? " ".repeat(item[0].length) : /^\s*/.exec(line.text)![0];
      const insert = "\n" + (inFence(state, r.from) ? /^\s*/.exec(line.text)![0] : indent);
      return { changes: { from: r.from, to: r.to, insert }, range: EditorSelection.cursor(r.from + insert.length) };
    }),
    { userEvent: "input", scrollIntoView: true },
  );
  return true;
};

// ── 3. Tab / Shift-Tab ─────────────────────────────────────────────────────

/** The list items whose lines the selection starts on, outermost only. */
function selectedItems(state: EditorState): Node[] {
  const items: Node[] = [];
  for (const line of selectedLines(state)) {
    const indent = /^\s*/.exec(line.text)![0].length;
    if (indent === line.length) continue;
    const item = ancestor(state, line.from + indent, "ListItem");
    if (!item || state.doc.lineAt(item.from).number !== line.number) continue;
    if (items.some((i) => i.from <= item.from && item.to <= i.to)) continue;
    items.push(item);
  }
  return items;
}

const column = (state: EditorState, pos: number) => pos - state.doc.lineAt(pos).from;

/** Shift every line of `item` (children included) by `delta` columns. */
function shiftItem(state: EditorState, item: Node, delta: number): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  for (let l = state.doc.lineAt(item.from).number, end = state.doc.lineAt(item.to).number; l <= end; l++) {
    const line = state.doc.line(l);
    if (!line.text.trim()) continue;
    if (delta > 0) changes.push({ from: line.from, insert: " ".repeat(delta) });
    else {
      const lead = /^ */.exec(line.text)![0].length;
      const cut = Math.min(lead, -delta);
      if (cut) changes.push({ from: line.from, to: line.from + cut });
    }
  }
  return changes;
}

const tab: Command = (view) => {
  const { state } = view;
  if (inFence(state, state.selection.main.head)) {
    if (state.selection.ranges.some((r) => !r.empty)) return indentMore(view);
    view.dispatch(state.replaceSelection(" ".repeat(getIndentUnit(state))), { userEvent: "input" });
    return true;
  }
  const changes: ChangeSpec[] = [];
  for (const item of selectedItems(state)) {
    const prev = item.prevSibling;
    if (!prev || prev.name !== "ListItem") continue; // the first item has nothing to nest under
    const mark = prev.getChild("ListMark");
    if (!mark) continue;
    const target = column(state, mark.to) + 1;
    const delta = target - column(state, item.from);
    if (delta > 0) changes.push(...shiftItem(state, item, delta));
  }
  dispatchLines(view, changes);
  return true; // Tab outside a list does nothing (no accidental code block)
};

const shiftTab: Command = (view) => {
  const { state } = view;
  if (inFence(state, state.selection.main.head)) return indentLess(view);
  const changes: ChangeSpec[] = [];
  for (const item of selectedItems(state)) {
    const parent = item.parent?.parent;
    if (!parent || parent.name !== "ListItem") continue; // already top level
    const delta = column(state, item.from) - column(state, parent.from);
    if (delta > 0) changes.push(...shiftItem(state, item, -delta));
  }
  dispatchLines(view, changes);
  return true;
};

// ── 4. Backspace ───────────────────────────────────────────────────────────

const MARKER_ONLY = /^(\s*)(?:#{1,6}[ \t]+|(?:>[ \t]?)+(?:\[![\w-]+\][-+]?[ \t]*)?|(?:[-*+]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)$/;

const smartBackspace: Command = (view) => {
  const { state } = view;
  if (state.selection.ranges.length > 1) return false;
  const r = state.selection.main;
  if (!r.empty) return false;
  const line = state.doc.lineAt(r.head);
  if (inFence(state, r.head)) return false;
  const before = state.sliceDoc(line.from, r.head);
  const m = MARKER_ONLY.exec(before);
  if (m) {
    // First press: the block becomes a paragraph, keeping its indent.
    view.dispatch({ changes: { from: line.from + m[1]!.length, to: r.head }, userEvent: "delete.backward", scrollIntoView: true });
    return true;
  }
  if (before.length > 0 && /^[ \t]+$/.test(before) && line.number > 1) {
    // Second press: join with the line above, indent and all.
    view.dispatch({ changes: { from: line.from - 1, to: r.head }, userEvent: "delete.backward", scrollIntoView: true });
    return true;
  }
  return false;
};

// ── 5. ``` + Enter closes the fence ────────────────────────────────────────

const closeFence: Command = (view) => {
  const { state } = view;
  const r = state.selection.main;
  if (!r.empty || state.selection.ranges.length > 1) return false;
  const line = state.doc.lineAt(r.head);
  if (r.head !== line.to) return false;
  const m = /^(\s*)(`{3,}|~{3,})([^`]*)$/.exec(line.text);
  if (!m) return false;
  const fence = ancestor(state, line.from + m[1]!.length, "FencedCode");
  // An opening fence that nothing closes: Lezer runs it to the end of the note.
  if (!fence || fence.from !== line.from + m[1]!.length || fence.getChildren("CodeMark").length > 1) return false;
  const indent = m[1]!;
  view.dispatch({
    changes: { from: r.head, insert: `\n${indent}\n${indent}${m[2]}` },
    selection: EditorSelection.cursor(r.head + 1 + indent.length),
    userEvent: "input",
    scrollIntoView: true,
  });
  return true;
};

// ── 5 & 6. Typed shortcuts, pairing and wrapping ──────────────────────────

const WRAP: Record<string, [string, string]> = { "*": ["*", "*"], _: ["_", "_"], "`": ["`", "`"], "~": ["~", "~"], "[": ["[", "]"], "(": ["(", ")"], '"': ['"', '"'] };
const PAIRS = new Set(["(", "[", "{", "`"]);

const typing = EditorView.inputHandler.of((view, from, to, text) => {
  const { state } = view;
  // Wrapping: a wrap char typed over a selection wraps it instead of replacing it.
  if (WRAP[text] && state.selection.ranges.some((r) => !r.empty)) {
    const [open, close] = WRAP[text]!;
    view.dispatch(
      state.changeByRange((r) =>
        r.empty
          ? { changes: { from: r.from, insert: open }, range: EditorSelection.cursor(r.from + open.length) }
          : {
              changes: [
                { from: r.from, insert: open },
                { from: r.to, insert: close },
              ],
              range: EditorSelection.range(r.from + open.length, r.to + open.length),
            },
      ),
      { userEvent: "input.type" },
    );
    return true;
  }
  if (from !== to) return false;
  // No pairing inside code, nor for backticks opening a line (a fence is being typed).
  if (PAIRS.has(text)) {
    const lineStart = state.doc.lineAt(from).from;
    if (!proseAt(state, from) || (text === "`" && /^\s*`*$/.test(state.sliceDoc(lineStart, from)))) {
      view.dispatch({ changes: { from, insert: text }, selection: EditorSelection.cursor(from + 1), userEvent: "input.type" });
      return true;
    }
    return false;
  }
  // `[] ` or `[ ] ` at a line start becomes a task: typed first, rewritten as its own undo step.
  if (text === " ") {
    const line = state.doc.lineAt(from);
    const m = /^(\s*)\[ ?\]$/.exec(state.sliceDoc(line.from, from));
    if (!m || !proseAt(state, from)) return false;
    view.dispatch({ changes: { from, insert: " " }, selection: EditorSelection.cursor(from + 1), userEvent: "input.type" });
    const start = line.from + m[1]!.length;
    view.dispatch({
      changes: { from: start, to: from + 1, insert: "- [ ] " },
      selection: EditorSelection.cursor(start + 6),
      annotations: isolateHistory.of("full"),
      userEvent: "input.autoformat",
    });
    return true;
  }
  return false;
});

/** Only ( [ { and backticks pair; quotes, `*` and `_` never do. */
const pairing = EditorState.languageData.of(() => [{ closeBrackets: { brackets: ["(", "[", "{", "`"] } }]);

// ── 7. Formatting chords ───────────────────────────────────────────────────

/** Mod-E / Mod-K act on a selection only: an empty one falls through to the shell (reading mode / palette). */
const onSelection =
  (cmd: Command): Command =>
  (view) =>
    view.state.selection.ranges.some((r) => !r.empty) ? cmd(view) : false;

const toggleLink: Command = (view) => {
  const { state } = view;
  const r = state.selection.main;
  const text = state.sliceDoc(r.from, r.to);
  const whole = /^\[([^\]]*)\]\([^)]*\)$/.exec(text);
  if (whole) {
    view.dispatch({ changes: { from: r.from, to: r.to, insert: whole[1]! }, selection: EditorSelection.range(r.from, r.from + whole[1]!.length), userEvent: "input" });
    return true;
  }
  const link = ancestor(state, r.from, "Link");
  if (link && link.to >= r.to && link.getChild("URL")) {
    const marks = link.getChildren("LinkMark");
    const label = marks.length >= 2 ? state.sliceDoc(marks[0]!.to, marks[1]!.from) : text;
    view.dispatch({ changes: { from: link.from, to: link.to, insert: label }, selection: EditorSelection.range(link.from, link.from + label.length), userEvent: "input" });
    return true;
  }
  // Variant D hides the URL as it is typed, so it is asked for instead.
  if (getVariant() === "D") {
    const url = window.prompt("Link to", "https://");
    if (!url) return true;
    view.dispatch({ changes: { from: r.from, to: r.to, insert: `[${text}](${url})` }, userEvent: "input" });
    return true;
  }
  view.dispatch({ changes: { from: r.from, to: r.to, insert: `[${text}]()` }, selection: EditorSelection.cursor(r.from + text.length + 3), userEvent: "input" });
  return true;
};

type ListKind = "bullet" | "ordered" | "task";
const LIST_PREFIX = /^(\s*)(?:([-*+])[ \t]+(\[[ xX]\][ \t]+)?|(\d+)[.)][ \t]+)?/;

function kindOf(text: string): ListKind | null {
  const m = LIST_PREFIX.exec(text)!;
  if (m[2]) return m[3] ? "task" : "bullet";
  if (m[4]) return "ordered";
  return null;
}

function setList(kind: ListKind): Command {
  return (view) => {
    const lines = selectedLines(view.state).filter((l, _i, all) => l.text.trim() || all.length === 1);
    const all = lines.every((l) => kindOf(l.text) === kind);
    const changes: ChangeSpec[] = [];
    lines.forEach((line, i) => {
      const m = LIST_PREFIX.exec(line.text)!;
      const from = line.from + m[1]!.length;
      const to = line.from + m[0].length;
      const insert = all ? "" : kind === "bullet" ? "- " : kind === "task" ? "- [ ] " : `${i + 1}. `;
      if (from !== to || insert) changes.push({ from, to, insert });
    });
    dispatchLines(view, changes);
    return true;
  };
}

function setHeading(level: number): Command {
  return (view) => {
    const lines = selectedLines(view.state);
    const all = lines.every((l) => new RegExp(`^\\s*#{${level}}[ \\t]`).test(l.text));
    const changes: ChangeSpec[] = [];
    for (const line of lines) {
      const m = /^(\s*)(#{1,6}[ \t]+)?/.exec(line.text)!;
      const from = line.from + m[1]!.length;
      changes.push({ from, to: from + (m[2]?.length ?? 0), insert: all ? "" : "#".repeat(level) + " " });
    }
    dispatchLines(view, changes);
    return true;
  };
}

// ── 8. Paste ───────────────────────────────────────────────────────────────

let plainNext = false;
const RICH = /<(h[1-6]|ul|ol|li|a\s|strong|b[\s>]|em|i[\s>]|code|pre|blockquote|del|s[\s>]|strike)/i;

type Turndown = InstanceType<typeof import("turndown")>;
let turndown: Promise<Turndown> | null = null;

function loadTurndown(): Promise<Turndown> {
  turndown ??= import("turndown").then(({ default: TurndownService }) => {
    const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-", codeBlockStyle: "fenced", emDelimiter: "*", strongDelimiter: "**", hr: "---" });
    td.remove(["style", "script", "meta", "title"]);
    td.addRule("strike", { filter: ["del", "s", "strike" as keyof HTMLElementTagNameMap], replacement: (c) => `~~${c}~~` });
    // Google Docs wraps the whole clipboard in a non-bold <b>, and styles spans instead.
    td.addRule("docsWrapper", { filter: (n) => n.nodeName === "B" && (n as HTMLElement).id?.startsWith("docs-internal-guid"), replacement: (c) => c });
    td.addRule("styledSpan", {
      filter: (n) => n.nodeName === "SPAN" && /font-weight:\s*(700|bold)|font-style:\s*italic/.test((n as HTMLElement).getAttribute("style") ?? ""),
      replacement: (c, n) => {
        if (!c.trim()) return c;
        const style = (n as HTMLElement).getAttribute("style") ?? "";
        let out = c;
        if (/font-style:\s*italic/.test(style)) out = `*${out}*`;
        if (/font-weight:\s*(700|bold)/.test(style)) out = `**${out}**`;
        return out;
      },
    });
    td.addRule("listItem", {
      filter: "li",
      replacement(content, node) {
        const body = content.replace(/^\n+/, "").replace(/\n+$/, "\n").replace(/\n/gm, "\n  ");
        const parent = node.parentNode as HTMLElement | null;
        let prefix = "- ";
        if (parent?.nodeName === "OL") {
          const start = Number(parent.getAttribute("start") ?? 1);
          prefix = `${start + Array.prototype.indexOf.call(parent.children, node)}. `;
        }
        return prefix + body + (node.nextSibling && !/\n$/.test(body) ? "\n" : "");
      },
    });
    return td;
  });
  return turndown;
}

const paste = EditorView.domEventHandlers({
  keydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.code === "KeyV") {
      plainNext = true;
      setTimeout(() => (plainNext = false), 1000);
    }
    return false;
  },
  paste(event, view) {
    const data = event.clipboardData;
    if (!data) return false;
    const plain = data.getData("text/plain");
    if (plainNext) {
      plainNext = false;
      event.preventDefault();
      view.dispatch(view.state.replaceSelection(plain), { userEvent: "input.paste", scrollIntoView: true });
      return true;
    }
    const html = data.getData("text/html");
    if (!html || !RICH.test(html) || !proseAt(view.state, view.state.selection.main.from)) return false;
    // A bare URL stays a plain URL (and over a selection, lang-markdown makes it a link).
    if (/^\s*(https?:\/\/|mailto:|www\.)\S+\s*$/.test(plain)) return false;
    event.preventDefault();
    void loadTurndown().then((td) => {
      const md = td.turndown(html).replace(/\n{3,}/g, "\n\n").trim();
      view.dispatch(view.state.replaceSelection(md || plain), { userEvent: "input.paste", scrollIntoView: true });
    });
    return true;
  },
});

export function smartTyping(): Extension {
  return [
    Prec.highest([
      typing,
      paste,
      keymap.of([
        { key: "Enter", run: closeFence },
        { key: "Shift-Enter", run: softBreak },
        { key: "Tab", run: tab, shift: shiftTab },
        { key: "Backspace", run: smartBackspace },
        ...closeBracketsKeymap,
        { key: "Mod-b", run: wrapWith("**"), preventDefault: true },
        { key: "Mod-i", run: wrapWith("*"), preventDefault: true },
        { key: "Mod-e", run: onSelection(wrapWith("`")) },
        { key: "Mod-Shift-s", run: wrapWith("~~"), preventDefault: true },
        { key: "Mod-k", run: onSelection(toggleLink) },
        { key: "Mod-Shift-7", run: setList("ordered"), preventDefault: true },
        { key: "Mod-Shift-8", run: setList("bullet"), preventDefault: true },
        { key: "Mod-Shift-9", run: setList("task"), preventDefault: true },
        { key: "Mod-Alt-1", run: setHeading(1), preventDefault: true },
        { key: "Mod-Alt-2", run: setHeading(2), preventDefault: true },
        { key: "Mod-Alt-3", run: setHeading(3), preventDefault: true },
      ]),
    ]),
    pairing,
    closeBrackets(),
  ];
}
