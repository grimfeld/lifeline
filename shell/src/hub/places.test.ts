import { describe, expect, it } from "vitest";
import { initApps } from "@lifeline/core";
import { findPlaces, hubPlaces } from "./places";

initApps([]);

describe("hubPlaces", () => {
  it("lists the Workspace's Modules in its order, skipping an unknown one, then Calendar, Map, Graph and Screens", () => {
    const { modules, surfaces } = hubPlaces(["money", "nope", "house"]);
    expect(modules.map((p) => p.key)).toEqual(["money", "house"]);
    expect(surfaces.map((p) => p.title)).toEqual(["Calendar", "Map", "Graph", "Screens"]);
  });
});

describe("findPlaces", () => {
  const places = [{ title: "Money" }, { title: "Map" }, { title: "Graph" }];

  it("narrows to the names holding the query, ignoring case and surrounding spaces", () => {
    expect(findPlaces(places, "  MA ").map((p) => p.title)).toEqual(["Map"]);
    expect(findPlaces(places, "a").map((p) => p.title)).toEqual(["Map", "Graph"]);
  });

  it("keeps every place for an empty query, and none when nothing matches", () => {
    expect(findPlaces(places, "   ")).toEqual(places);
    expect(findPlaces(places, "zzz")).toEqual([]);
  });
});
