import { describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import { ensureSyntaxTree } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
// The widgets' React views pull the UI barrel (and leaflet, which wants a window); the fields under test never render them.
vi.mock("./DaylogBlock", () => ({ DaylogBlock: () => null }));
vi.mock("./AttachmentImage", () => ({ AttachmentImage: () => null }));

import { affectsEmbeds, contextField, daylogField, focusedField, proseAt, setFocused } from "./editorExtensions";

const stateOf = (doc: string) => {
  const state = EditorState.create({ doc, extensions: [markdown({ base: markdownLanguage }), contextField, focusedField, daylogField] });
  ensureSyntaxTree(state, state.doc.length, 5000);
  return state;
};

describe("proseAt", () => {
  const doc = "a [[x]] `[[y]]`\n\n```\n[[z]]\n```\n\n# Head #t\n\nend #u";
  const state = stateOf(doc);
  it("is prose for a plain link", () => expect(proseAt(state, doc.indexOf("[[x"))).toBe(true));
  it("is not prose inside inline code", () => expect(proseAt(state, doc.indexOf("[[y"))).toBe(false));
  it("is not prose inside a fence", () => expect(proseAt(state, doc.indexOf("[[z"))).toBe(false));
  it("keeps tags off heading lines", () => {
    expect(proseAt(state, doc.indexOf("#t"), true)).toBe(false);
    expect(proseAt(state, doc.indexOf("#u"), true)).toBe(true);
  });
});

describe("daylogField", () => {
  const doc = "intro line\n\n```daylog\ndate: 2026-10-03\n```\n\nafter";
  const focused = (s: EditorState) => s.update({ effects: setFocused.of(true) }).state;

  it("keeps its value while the cursor moves outside a block", () => {
    const s0 = focused(stateOf(doc));
    const s1 = s0.update({ selection: { anchor: 3 } }).state;
    const s2 = s1.update({ selection: { anchor: doc.length - 1 } }).state;
    expect(s1.field(daylogField)).toBe(s0.field(daylogField));
    expect(s2.field(daylogField)).toBe(s0.field(daylogField));
  });

  it("rebuilds when the cursor enters a block, and shows its source", () => {
    const s0 = focused(stateOf(doc));
    const s1 = s0.update({ selection: { anchor: doc.indexOf("date") } }).state;
    expect(s1.field(daylogField)).not.toBe(s0.field(daylogField));
    expect(s0.field(daylogField).deco.size).toBe(1);
    expect(s1.field(daylogField).deco.size).toBe(0);
  });
});

describe("affectsEmbeds", () => {
  const doc = "plain line\n![[cat.png]] caption\nmore";
  const s = stateOf(doc);
  it("is false for ordinary typing away from an embed", () => {
    expect(affectsEmbeds(s.update({ changes: { from: 2, insert: "x" } }))).toBe(false);
  });
  it("is true for typing on an embed's line", () => {
    expect(affectsEmbeds(s.update({ changes: { from: doc.indexOf("caption"), insert: "x" } }))).toBe(true);
  });
  it("is true for a bracket or a line break", () => {
    expect(affectsEmbeds(s.update({ changes: { from: 2, insert: "[" } }))).toBe(true);
    expect(affectsEmbeds(s.update({ changes: { from: 2, insert: "\n" } }))).toBe(true);
  });
});
