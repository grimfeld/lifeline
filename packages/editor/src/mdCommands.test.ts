import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, type TransactionSpec } from "@codemirror/state";
import type { Command, EditorView } from "@codemirror/view";
import { cycleHeading, insertWikilink, toggleBullet, toggleQuote, toggleTask, wrapWith } from "./mdCommands";

/**
 * The commands only ever read `view.state` and dispatch, so they can be
 * exercised on a bare state — no DOM, no CodeMirror view. `|` marks the cursor
 * in both the input and the expected output; `«…»` marks a selection.
 */
function run(cmd: Command, input: string): string {
  const sel = input.includes("«")
    ? { anchor: input.indexOf("«"), head: input.indexOf("»") - 1 }
    : { anchor: input.indexOf("|"), head: input.indexOf("|") };
  let state = EditorState.create({
    doc: input.replace(/[|«»]/g, ""),
    selection: EditorSelection.single(sel.anchor, sel.head),
  });
  const view = {
    get state() {
      return state;
    },
    dispatch: (...specs: TransactionSpec[]) => {
      state = state.update(...specs).state;
    },
    focus: () => {},
  } as unknown as EditorView;
  cmd(view);
  const doc = state.doc.toString();
  const { from, to } = state.selection.main;
  return from === to ? doc.slice(0, from) + "|" + doc.slice(from) : doc.slice(0, from) + "«" + doc.slice(from, to) + "»" + doc.slice(to);
}

describe("wrapWith", () => {
  const bold = wrapWith("**");
  const italic = wrapWith("*");

  it("opens an empty pair with the cursor between the halves", () => {
    expect(run(bold, "say |")).toBe("say **|**");
  });

  it("wraps the selection and keeps it selected", () => {
    expect(run(bold, "say «hi» there")).toBe("say **«hi»** there");
  });

  it("unwraps when the markers are inside the selection", () => {
    expect(run(bold, "say «**hi**» there")).toBe("say «hi» there");
  });

  it("unwraps when the markers surround the selection — a second tap undoes the first", () => {
    expect(run(bold, "say **«hi»** there")).toBe("say «hi» there");
  });

  it("nests inside a longer run rather than eating it", () => {
    expect(run(italic, "say **«hi»** there")).toBe("say ***«hi»*** there");
    expect(run(italic, "say «**hi**» there")).toBe("say *«**hi**»* there");
  });
});

describe("toggleBullet", () => {
  it("adds the marker after the indent", () => {
    expect(run(toggleBullet, "  ta|sk")).toBe("  - ta|sk");
  });

  it("removes it on a second tap, indent intact", () => {
    expect(run(toggleBullet, "  - ta|sk")).toBe("  ta|sk");
  });

  it("gives every line of a mixed selection the marker", () => {
    expect(run(toggleBullet, "«- one\ntwo»")).toBe("«- one\n- two»");
  });

  it("leaves a task line alone — that is the task button's marker", () => {
    expect(run(toggleBullet, "- [ ] wa|sh")).toBe("- - [ ] wa|sh");
  });
});

describe("toggleQuote", () => {
  it("quotes and unquotes a whole selection", () => {
    expect(run(toggleQuote, "«one\ntwo»")).toBe("«> one\n> two»");
    expect(run(toggleQuote, "«> one\n> two»")).toBe("«one\ntwo»");
  });
});

describe("cycleHeading", () => {
  it("cycles none → # → ## → ### → none", () => {
    expect(run(cycleHeading, "ti|tle")).toBe("# ti|tle");
    expect(run(cycleHeading, "# ti|tle")).toBe("## ti|tle");
    expect(run(cycleHeading, "## ti|tle")).toBe("### ti|tle");
    expect(run(cycleHeading, "### ti|tle")).toBe("ti|tle");
  });

  it("takes the whole selection to the level the first line goes to", () => {
    expect(run(cycleHeading, "«one\n## two»")).toBe("«# one\n# two»");
  });
});

describe("toggleTask", () => {
  it("makes a plain line a task", () => {
    expect(run(toggleTask, "wa|sh up")).toBe("- [ ] wa|sh up");
  });

  it("makes a bullet a task without doubling the marker", () => {
    expect(run(toggleTask, "- wa|sh up")).toBe("- [ ] wa|sh up");
  });

  it("ticks and unticks a task that is already one", () => {
    expect(run(toggleTask, "- [ ] wa|sh up")).toBe("- [x] wa|sh up");
    expect(run(toggleTask, "- [x] wa|sh up")).toBe("- [ ] wa|sh up");
  });

  it("keeps the indent of a nested task", () => {
    expect(run(toggleTask, "  - [ ] wa|sh up")).toBe("  - [x] wa|sh up");
  });
});

describe("insertWikilink", () => {
  it("opens the brackets with the cursor where the picker's query goes", () => {
    expect(run(insertWikilink, "see |")).toBe("see [[|]]");
  });

  it("takes the selection as the name it starts searching for", () => {
    expect(run(insertWikilink, "see «Kant» here")).toBe("see [[Kant|]] here");
  });
});
