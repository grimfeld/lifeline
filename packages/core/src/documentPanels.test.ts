import { describe, expect, it } from "vitest";
import { documentPanels, initApps } from "./registry";
import type { AppManifest } from "./manifest";

const Nothing = () => null;
const app = (id: string, panels: NonNullable<AppManifest["documentPanels"]>): AppManifest => ({ id, title: id, types: [], screens: [], cards: [], commands: [], documentPanels: panels });

initApps([
  app("library", [{ id: "library.author", component: Nothing }]),
  app("memories", [
    { id: "memories.panel", component: Nothing, peek: true },
    { id: "memories.editor-only", component: Nothing },
  ]),
  app("museum", [{ id: "museum.artist", component: Nothing, peek: true }]),
]);

describe("documentPanels", () => {
  it("lists every panel, in registry App order, with its App", () => {
    expect(documentPanels().map((p) => `${p.appId}/${p.id}`)).toEqual(["library/library.author", "memories/memories.panel", "memories/memories.editor-only", "museum/museum.artist"]);
  });

  it("filters to the panels that opt into the Peek, keeping order", () => {
    expect(documentPanels({ peek: true }).map((p) => p.id)).toEqual(["memories.panel", "museum.artist"]);
  });
});
