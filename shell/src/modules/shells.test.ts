import { beforeAll, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { DASHBOARD_FRAME, type AppManifest } from "@lifeline/core";

/**
 * A hand-written Module lists its places by hand (ADR 0057), so an App screen
 * it forgets is reachable only by URL. Every listed (not hidden) screen of a
 * Module's Apps must be one of its places.
 *
 * A deliberate omission goes in `EXCEPTIONS` as the screen id ("<app>.<screen>"),
 * with the reason.
 */
const EXCEPTIONS: Record<string, string> = {};

let MODULE_SHELLS: typeof import("./shells").MODULE_SHELLS;
let APPS: AppManifest[] = [];

/** The listed screens of a Module's Apps, as ids ("<app>.<screen>") (core's `moduleScreens`, over the Apps the shell registers). */
const listedScreens = (moduleId: string) =>
  APPS.filter((a) => a.module === moduleId).flatMap((a) =>
    a.screens.filter((s) => !s.hidden && (s.frame ?? DASHBOARD_FRAME) === DASHBOARD_FRAME).map((s) => s.id),
  );

beforeAll(async () => {
  const { window } = new JSDOM("<!doctype html>", { url: "http://localhost/" });
  for (const name of ["window", "document", "navigator", "HTMLElement", "Element"] as const) vi.stubGlobal(name, name === "window" ? window : window[name]);
  ({ APPS } = await import("../apps"));
  ({ MODULE_SHELLS } = await import("./shells"));
}, 180_000);

describe("hand-written Modules", () => {
  it("list every screen of their Apps as a place", () => {
    const left: string[] = [];
    for (const [moduleId, shell] of Object.entries(MODULE_SHELLS)) {
      for (const id of listedScreens(moduleId)) {
        if (!shell.placeScreens.includes(id) && !(id in EXCEPTIONS)) left.push(`${moduleId}: ${id}`);
      }
    }
    expect(left, "screens no place of their Module reaches").toEqual([]);
  });

  it("keep no exception for a screen that is a place or does not exist", () => {
    const stale = Object.keys(EXCEPTIONS).filter((id) =>
      Object.entries(MODULE_SHELLS).every(([m, shell]) => shell.placeScreens.includes(id) || !listedScreens(m).includes(id)),
    );
    expect(stale).toEqual([]);
  });
});
