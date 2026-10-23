import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import { EditorView, type Command } from "@codemirror/view";
import { startCompletion } from "@codemirror/autocomplete";

/**
 * The markdown edits the accessory bar runs (ADR 0021 amendment). Plain
 * CodeMirror `Command`s, so they are equally usable from a keymap later —
 * nothing here knows about the bar.
 */

/**
 * Toggle a symmetric inline marker (`**`, `*`, `~~`, `` ` ``) around each range.
 * Removes the marker when the selection *is* wrapped or *sits inside* a wrap
 * (`foo` selected in `**foo**`), so a second tap undoes the first. An empty
 * selection opens an empty pair with the cursor between the halves.
 */
export function wrapWith(mark: string): Command {
  const len = mark.length;
  return (view) => {
    const { state } = view;
    view.dispatch(
      state.changeByRange((range) => {
        if (range.empty) {
          return { changes: { from: range.from, insert: mark + mark }, range: EditorSelection.cursor(range.from + len) };
        }
        // A marker that continues past the pair is a longer run, not this pair:
        // `*` inside `**bold**` must nest to `***bold***`, not eat the bold.
        const text = state.sliceDoc(range.from, range.to);
        if (
          text.length > 2 * len &&
          text.startsWith(mark) &&
          text.endsWith(mark) &&
          text.slice(len, 2 * len) !== mark &&
          text.slice(-2 * len, -len) !== mark
        ) {
          return {
            changes: { from: range.from, to: range.to, insert: text.slice(len, -len) },
            range: EditorSelection.range(range.from, range.to - 2 * len),
          };
        }
        const before = state.sliceDoc(Math.max(0, range.from - len), range.from);
        const after = state.sliceDoc(range.to, Math.min(state.doc.length, range.to + len));
        const outerBefore = state.sliceDoc(Math.max(0, range.from - 2 * len), Math.max(0, range.from - len));
        const outerAfter = state.sliceDoc(Math.min(state.doc.length, range.to + len), Math.min(state.doc.length, range.to + 2 * len));
        if (before === mark && after === mark && outerBefore !== mark && outerAfter !== mark) {
          return {
            changes: [
              { from: range.from - len, to: range.from },
              { from: range.to, to: range.to + len },
            ],
            range: EditorSelection.range(range.from - len, range.to - len),
          };
        }
        return {
          changes: [
            { from: range.from, insert: mark },
            { from: range.to, insert: mark },
          ],
          range: EditorSelection.range(range.from + len, range.to + len),
        };
      }),
      { userEvent: "input", scrollIntoView: true },
    );
    return true;
  };
}

/**
 * Line edits keep the selection over the lines they touched: a prefix inserted at
 * the selection.s start maps outside it by default, so the first line would look
 * dropped after one tap.
 */
function dispatchLines(view: EditorView, changes: ChangeSpec[]) {
  if (!changes.length) return;
  const set = view.state.changes(changes);
  // `SelectionRange.map` pushes a range's start off an insertion made at it, so
  // the default mapping would leave the first line's new prefix outside the
  // selection; a cursor, on the other hand, should ride along with its line.
  const { ranges, mainIndex } = view.state.selection;
  const selection = EditorSelection.create(
    ranges.map((r) => (r.empty ? EditorSelection.cursor(set.mapPos(r.head, 1)) : EditorSelection.range(set.mapPos(r.from, -1), set.mapPos(r.to, 1)))),
    mainIndex,
  );
  view.dispatch({ changes: set, selection, userEvent: "input", scrollIntoView: true });
}

/** Every line touched by the selection, in document order and without repeats. */
function selectedLines(view: EditorView) {
  const lines = [];
  const seen = new Set<number>();
  for (const range of view.state.selection.ranges) {
    for (let pos = range.from; ; ) {
      const line = view.state.doc.lineAt(pos);
      if (!seen.has(line.from)) {
        seen.add(line.from);
        lines.push(line);
      }
      if (line.to >= range.to) break;
      pos = line.to + 1;
    }
  }
  return lines.sort((a, b) => a.from - b.from);
}

/**
 * Add `prefix` to every selected line, or strip the prefix `match` from all of
 * them when all of them already carry it — the usual list/quote toggle. The
 * prefix goes after the line's indent, so it survives nesting.
 */
export function toggleLinePrefix(prefix: string, match: RegExp): Command {
  return (view) => {
    const lines = selectedLines(view);
    const all = lines.every((l) => match.test(l.text));
    const changes: ChangeSpec[] = [];
    for (const line of lines) {
      const found = match.exec(line.text);
      const indent = /^\s*/.exec(line.text)![0].length;
      if (found) {
        // A mixed selection gains the prefix everywhere; only an all-prefixed one loses it.
        if (all) changes.push({ from: line.from + indent, to: line.from + found[0].length });
        continue;
      }
      changes.push({ from: line.from + indent, insert: prefix });
    }
    dispatchLines(view, changes);
    return true;
  };
}

const HEADING = /^(\s*)(#{1,6}) /;

/**
 * Cycle the selected lines' heading level: none → `#` → `##` → `###` → none.
 * One button rather than six; deeper levels are typed, as on the desktop.
 */
export const cycleHeading: Command = (view) => {
  const lines = selectedLines(view);
  const first = HEADING.exec(lines[0]?.text ?? "");
  const level = first ? first[2]!.length : 0;
  const next = level >= 3 ? 0 : level + 1;
  const changes: ChangeSpec[] = [];
  for (const line of lines) {
    const found = HEADING.exec(line.text);
    const from = line.from + (found ? found[1]!.length : /^\s*/.exec(line.text)![0].length);
    const to = from + (found ? found[2]!.length + 1 : 0);
    const insert = next ? "#".repeat(next) + " " : "";
    if (from !== to || insert) changes.push({ from, to, insert });
  }
  dispatchLines(view, changes);
  return true;
};

const TASK = /^(\s*)([-*+] )\[([ xX])\] /;
const BULLET = /^\s*[-*+] /;

/**
 * One button for the whole checkbox chore: a line that is already a task ticks
 * and unticks, a bullet becomes a task, anything else becomes a task line.
 * Ticking is what a phone cannot do otherwise — `[ ]` → `[x]` is three
 * characters of caret placement with a fingertip.
 */
export const toggleTask: Command = (view) => {
  const lines = selectedLines(view);
  const marks = lines.map((l) => TASK.exec(l.text));
  const done = marks.length > 0 && marks.every((m) => m !== null && m[3] !== " ");
  const changes: ChangeSpec[] = [];
  for (const [i, line] of lines.entries()) {
    const task = marks[i];
    if (task) {
      const at = line.from + task[1]!.length + task[2]!.length + 1;
      changes.push({ from: at, to: at + 1, insert: done ? " " : "x" });
      continue;
    }
    const bullet = BULLET.exec(line.text);
    if (bullet) {
      changes.push({ from: line.from + bullet[0].length, insert: "[ ] " });
      continue;
    }
    const indent = /^\s*/.exec(line.text)![0].length;
    changes.push({ from: line.from + indent, insert: "- [ ] " });
  }
  dispatchLines(view, changes);
  return true;
};

export const toggleBullet = toggleLinePrefix("- ", /^\s*[-*+] (?!\[[ xX]\] )/);
export const toggleQuote = toggleLinePrefix("> ", /^\s*> /);

/**
 * Open a wikilink around the selection and immediately raise the note picker —
 * the same `[[` completion the desktop gets by typing, which is the whole point
 * of the button: linking on a phone is two taps, not two brackets and a search.
 */
export const insertWikilink: Command = (view) => {
  const { state } = view;
  const head = state.selection.main;
  const text = state.sliceDoc(head.from, head.to);
  view.dispatch({
    changes: { from: head.from, to: head.to, insert: `[[${text}]]` },
    selection: EditorSelection.cursor(head.from + 2 + text.length),
    userEvent: "input",
    scrollIntoView: true,
  });
  startCompletion(view);
  return true;
};

/** Insert literal text at the cursor (the `#` of a tag, an em dash…). */
export function insertText(text: string): Command {
  return (view) => {
    view.dispatch(view.state.replaceSelection(text), { userEvent: "input", scrollIntoView: true });
    return true;
  };
}
