import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { intakesOf } from "@lifeline/core";
import { readIntakeList } from "@lifeline/handoff";
import { intakeListJson } from "./intakes";

/**
 * The registry as the browser loads it, views and all: a DOM first, so the
 * browser-only libraries load — after the build, which reads it its own way in
 * plain Node (esbuild refuses to run beside jsdom's globals).
 */
async function registryIntakes() {
  const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/" });
  for (const name of ["window", "document", "navigator", "HTMLElement", "Element"] as const) vi.stubGlobal(name, name === "window" ? window : window[name]);
  const { APPS } = await import("../src/apps");
  return intakesOf(APPS).map((i) => ({ key: i.key, title: i.title }));
}

describe("the Intakes list the build publishes", () => {
  it("is every Intake in the App registry, key and title, in registry order", { timeout: 180_000 }, async () => {
    const published = readIntakeList(JSON.parse(await intakeListJson()));
    expect(published).toEqual(await registryIntakes());
    // The Intakes Lifeline has today (#117): a list that lost one would still match an emptied registry.
    expect(published).toEqual(
      expect.arrayContaining([
        { key: "tasks/task", title: "Task" },
        { key: "commonplace/quote", title: "Quote" },
        { key: "calendar/event", title: "Event" },
        { key: "shopping/need", title: "Need" },
        { key: "languages/word", title: "Word" },
        { key: "languages/sentence", title: "Sentence" },
        { key: "languages/fact", title: "Fact" },
      ]),
    );
  });
});
