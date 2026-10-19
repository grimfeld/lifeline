import { describe, expect, it } from "vitest";
import type { DocumentTypeDef } from "./documents/types";
import { originOf, typeIntakesOf } from "./contracts/intake";
import { groupIntakes, type IntakeGroup } from "./intakeGroups";

const T = (id: string, extra: Partial<DocumentTypeDef> = {}): DocumentTypeDef => ({
  id, label: id[0].toUpperCase() + id.slice(1) + "s", titleRule: "name", body: "optional", fields: [], builtIn: false, ...extra,
});

const MODULE_OF: Record<string, string | undefined> = { commonplace: "notes", tasks: "tasks", shopping: "house", calendar: undefined };
const APP_TITLE: Record<string, string> = { commonplace: "Notes", tasks: "Tasks", shopping: "Shopping list", calendar: "Calendar" };
const appIntake = (appId: string, id: string, title: string) => ({ appId, id, key: `${appId}/${id}`, title });
// Registry order — deliberately not Module order.
const APP_INTAKES = [appIntake("calendar", "event", "Event"), appIntake("commonplace", "quote", "Quote"), appIntake("shopping", "need", "Need"), appIntake("tasks", "task", "Task")];

type Listed = { appId: string; title: string; module?: string; typeId?: string };
const shape = (groups: IntakeGroup<Listed>[]) => groups.map((g) => [g.title, g.intakes.map((i) => i.title)]);
const group = (intakes: Listed[], currentModule?: string) =>
  groupIntakes(intakes, { moduleOf: (a) => MODULE_OF[a], appTitle: (a) => APP_TITLE[a], currentModule });

describe("Core's generic Intake for user-defined types", () => {
  it("is one per user-defined type, named by its singular, keyed by Core, homed in its Home Module", () => {
    const types = [T("task", { builtIn: true, appId: "tasks" }), T("person", { singular: "Person", homeModule: "journal" }), T("recipe")];
    expect(typeIntakesOf(types).map(({ key, appId, title, typeId, module }) => ({ key, appId, title, typeId, module }))).toEqual([
      { key: "core/person", appId: "core", title: "Person", typeId: "person", module: "journal" },
      { key: "core/recipe", appId: "core", title: "Recipe", typeId: "recipe", module: undefined },
    ]);
  });

  it("is not offered for an internal type", () => {
    expect(typeIntakesOf([T("draft", { internal: true })])).toEqual([]);
  });

  it("keeps one dialog per type, so a re-render does not remount it", () => {
    const a = typeIntakesOf([T("place")])[0].dialog;
    expect(typeIntakesOf([T("place")])[0].dialog).toBe(a);
    expect(typeIntakesOf([T("person")])[0].dialog).not.toBe(a);
  });
});

describe("the Handoff page's Intakes, grouped by Module", () => {
  const typeIntakes = typeIntakesOf([T("person", { singular: "Person", homeModule: "journal" }), T("place", { homeModule: "journal" }), T("bookmark", { homeModule: "notes" }), T("recipe")]);

  it("reads like the Selection menu: an App in no Module first, then Core's Module order, homeless types under Other last", () => {
    expect(shape(group([...APP_INTAKES, ...typeIntakes]))).toEqual([
      ["Calendar", ["Event"]],
      ["House", ["Need"]],
      ["Projects", ["Task"]],
      ["Journal", ["Person", "Place"]],
      ["Notes", ["Bookmark", "Quote"]],
      ["Other", ["Recipe"]],
    ]);
  });

  it("lists the Module the user is in first among the Modules", () => {
    expect(shape(group([...APP_INTAKES, ...typeIntakes], "notes")).map(([t]) => t)).toEqual(["Calendar", "Notes", "House", "Projects", "Journal", "Other"]);
  });

  it("puts a type homed in a Module this Lifeline does not know under Other", () => {
    expect(shape(group(typeIntakesOf([T("ghost", { homeModule: "mail" })])))).toEqual([["Other", ["Ghost"]]]);
  });
});

describe("where Core's generic Intake keeps the Handoff's origin", () => {
  const url = "https://bistro.example.com/";
  it("in the type's url Field when it has one", () => {
    const place = T("place", { fields: [{ key: "notes", label: "Notes", kind: "text" }, { key: "website", label: "Website", kind: "url" }] });
    expect(originOf(place, url, "")).toEqual({ fields: { website: url }, body: "" });
  });

  it("else in the body, after what the Template wrote", () => {
    expect(originOf(T("recipe"), url, "")).toEqual({ fields: {}, body: url });
    expect(originOf(T("recipe"), url, "## Ingredients\n")).toEqual({ fields: {}, body: `## Ingredients\n\n${url}` });
  });

  it("nowhere when there is none", () => {
    expect(originOf(T("recipe"), undefined, "Start")).toEqual({ fields: {}, body: "Start" });
  });
});
