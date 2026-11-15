import { beforeAll, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { PERSON_TYPE, type AppManifest, type CommandArg } from "@lifeline/core";

let APPS: AppManifest[] = [];

// The registry as the browser loads it: a DOM first, so the browser-only libraries load (as guide.test.ts does).
beforeAll(async () => {
  const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/" });
  for (const name of ["window", "document", "navigator", "HTMLElement", "Element"] as const) vi.stubGlobal(name, name === "window" ? window : window[name]);
  ({ APPS } = await import("../apps"));
}, 180_000);

/** Every argument of a Command, rows' columns included. */
const flat = (args: readonly CommandArg[]): CommandArg[] => args.flatMap((a) => [a, ...flat(a.of ?? [])]);

describe("the argument input of a list of links (ArgInput)", () => {
  // ArgInput draws every `links` argument as a People field; a Command taking a list of anything else must get its own input first.
  it("is a People field only because every Command's list of links is a list of People", () => {
    const notPeople: string[] = [];
    let seen = 0;
    for (const app of APPS)
      for (const c of app.commands ?? [])
        for (const a of flat("args" in c && Array.isArray(c.args) ? (c.args as CommandArg[]) : []))
          if (a.kind === "links") {
            seen++;
            if (a.linkType !== PERSON_TYPE) notPeople.push(`${app.id}/${c.title}: ${a.key}`);
          }
    expect(seen, "found no list of links: has this test's reading of the registry broken?").toBeGreaterThan(0);
    expect(notPeople).toEqual([]);
  });
});
