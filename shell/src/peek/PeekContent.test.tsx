// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, beforeAll, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { initApps, type AppManifest, type Document, type DocumentTypeDef } from "@lifeline/core";
import { PeekContent } from "./PeekContent";

const def: DocumentTypeDef = { id: "thing", label: "Thing", titleRule: "name", body: "none", fields: [], builtIn: true };
const doc = { id: "d1", type: "thing", title: "A thing", body: "" } as Document;

const panels: NonNullable<AppManifest["documentPanels"]> = [
  { id: "a.opted", peek: true, component: () => <p>Opted-in panel</p> },
  { id: "a.editor", component: () => <p>Editor-only panel</p> },
  { id: "a.silent", peek: true, component: () => null },
  { id: "a.second", peek: true, component: () => <p>Second panel</p> },
];
initApps([{ id: "a", title: "A", types: [def], screens: [], cards: [], commands: [], documentPanels: panels }]);

let root: Root | null = null;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(() => {
  act(() => root?.unmount());
  document.body.innerHTML = "";
});

async function draw(): Promise<HTMLElement> {
  const host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
  await act(async () => root!.render(<MemoryRouter><PeekContent doc={doc} def={def} /></MemoryRouter>));
  return host;
}

it("draws a panel that opts into the Peek, in registry order, and no editor-only one", async () => {
  const host = await draw();
  const text = host.textContent ?? "";
  expect(text).toContain("Opted-in panel");
  expect(text).not.toContain("Editor-only panel");
  expect(text.indexOf("Opted-in panel")).toBeLessThan(text.indexOf("Second panel"));
});

it("leaves nothing behind for a panel that returns null", async () => {
  const host = await draw();
  const filled = [...host.querySelectorAll("[data-peek-panel]")].filter((el) => el.childNodes.length > 0);
  expect(filled).toHaveLength(2);
});
