import { describe, expect, it, vi } from "vitest";
import { EditorState } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { LinkIndex, LinkRef } from "@lifeline/core";
// The widgets' React views pull the UI barrel (and leaflet, which wants a window); the command under test never renders them.
vi.mock("./DaylogBlock", () => ({ DaylogBlock: () => null }));
vi.mock("./AttachmentImage", () => ({ AttachmentImage: () => null }));

import { contextField, indexField, peekLinkAtCursor } from "./editorExtensions";

/** An index where every name resolves to a Document whose id is the name, lower-cased. */
const index = { resolve: (name: string): LinkRef => ({ kind: "doc", id: name.toLowerCase(), type: "person" }) } as unknown as LinkIndex;

function run(doc: string, cursor: number) {
  const peekRef = vi.fn();
  const state = EditorState.create({
    doc,
    selection: { anchor: cursor },
    extensions: [indexField.init(() => index), contextField.init(() => ({ docDate: null, openRef: vi.fn(), peekRef }))],
  });
  const handled = peekLinkAtCursor({ state } as EditorView);
  return { handled, peekRef };
}

describe("Ctrl+Enter peeks the wikilink under the cursor (ADR 0085)", () => {
  const doc = "Met [[Marie|my friend]] at noon, then ![[map.png]].";

  it("peeks the link's target when the cursor is in it", () => {
    const { handled, peekRef } = run(doc, doc.indexOf("Marie") + 2);
    expect(handled).toBe(true);
    expect(peekRef).toHaveBeenCalledWith({ kind: "doc", id: "marie", type: "person" }, "Marie");
  });

  it("peeks from the link's text too", () => {
    const { peekRef } = run(doc, doc.indexOf("friend"));
    expect(peekRef).toHaveBeenCalledWith({ kind: "doc", id: "marie", type: "person" }, "Marie");
  });

  it("does nothing outside a link, leaving the key to the editor's own binding", () => {
    for (const at of [0, doc.indexOf("[[") /* just before it */, doc.indexOf("]]") + 2 /* just after it */, doc.indexOf("noon")]) {
      const { handled, peekRef } = run(doc, at);
      expect(handled, `at ${at}`).toBe(false);
      expect(peekRef).not.toHaveBeenCalled();
    }
  });

  it("leaves an image embed alone", () => {
    const { handled, peekRef } = run(doc, doc.indexOf("map"));
    expect(handled).toBe(false);
    expect(peekRef).not.toHaveBeenCalled();
  });
});
