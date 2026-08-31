import { describe, expect, it } from "vitest";
import { initApps, navSectionsOf } from "./registry";
import { DASHBOARD_WORKSPACE, VAULT_WORKSPACE, type AppManifest, type AppScreenDef } from "./manifest";

const screen = (id: string, extra: Partial<AppScreenDef> = {}): AppScreenDef => ({
  id,
  title: id,
  path: id,
  component: () => null,
  ...extra,
});

const app = (id: string, screens: AppScreenDef[]): AppManifest => ({ id, title: id, types: [], screens, cards: [], commands: [] });

initApps([
  app("a", [
    screen("tasks", { group: "planning" }),
    screen("library", { group: "culture" }),
    screen("stat-detail", { group: "progress", hidden: true }),
  ]),
  app("b", [
    screen("chores", { group: "planning" }),
    screen("hub"),
    screen("odd", { group: "nonexistent" }),
    screen("journal", { group: "culture", workspace: VAULT_WORKSPACE }),
  ]),
]);

describe("navSectionsOf", () => {
  const sections = navSectionsOf(DASHBOARD_WORKSPACE);

  it("puts loose screens first, then groups in NAV_GROUPS order", () => {
    expect(sections.map((s) => s.group?.id)).toEqual([undefined, "planning", "culture"]);
    expect(sections[0].screens.map((s) => s.id)).toEqual(["hub", "odd"]);
  });

  it("keeps registry order inside a group, across Apps", () => {
    expect(sections[1].screens.map((s) => s.id)).toEqual(["tasks", "chores"]);
  });

  it("leaves out hidden screens, and empty groups with them", () => {
    expect(sections.flatMap((s) => s.screens).map((s) => s.id)).not.toContain("stat-detail");
    expect(sections.map((s) => s.group?.id)).not.toContain("progress");
  });

  it("groups each workspace on its own", () => {
    expect(navSectionsOf(VAULT_WORKSPACE).map((s) => s.screens.map((x) => x.id))).toEqual([["journal"]]);
  });
});
