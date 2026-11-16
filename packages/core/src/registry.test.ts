import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { DOCUMENT_TYPES, db } from "./data/db";
import { appsOfModule, inhabitedModules, moduleOfApp, moduleOfPath, moduleScreens, navSectionsOf } from "./registry";
import { initApps } from "./registry";
import { documentType, resetBuiltinType, saveDocumentType, saveFieldOptions, type DocumentTypeRecord } from "./documents/registry";
import { MODULES, DASHBOARD_FRAME, VAULT_FRAME, type AppManifest, type AppScreenDef } from "./manifest";

const screen = (id: string, extra: Partial<AppScreenDef> = {}): AppScreenDef => ({
  id,
  title: id,
  path: id,
  component: () => null,
  ...extra,
});

const app = (id: string, module: string | undefined, screens: AppScreenDef[]): AppManifest => ({
  id,
  title: id,
  module,
  types: [],
  screens,
  cards: [],
  commands: [],
});

const kinded = { id: "kinded", label: "Kinded", titleRule: "name", body: "none", builtIn: true, fields: [{ key: "kind", label: "Kind", kind: "choice", userOptions: true, options: [{ value: "cafe", label: "Cafe" }] }] } as const;

initApps([
  { ...app("kinded", "tasks", []), types: [kinded as never] },
  app("tasks", "tasks", [screen("tasks")]),
  app("library", "culture", [screen("library"), screen("shelf-detail", { hidden: true, path: "library/shelf/:id" })]),
  app("chores", "house", [screen("chores"), screen("journal", { frame: VAULT_FRAME })]),
  app("loose", undefined, [screen("hub")]),
  app("odd", "nonexistent", [screen("odd")]),
  app("empty", "progress", [screen("hidden-only", { hidden: true })]),
]);

describe("moduleOfApp", () => {
  it("resolves an App's Module", () => {
    expect(moduleOfApp("tasks")?.title).toBe("Projects");
  });

  it("is undefined for an App naming none or an unknown one", () => {
    expect(moduleOfApp("loose")).toBeUndefined();
    expect(moduleOfApp("odd")).toBeUndefined();
  });
});

describe("appsOfModule", () => {
  it("lists a Module's Apps in registry order", () => {
    expect(appsOfModule("culture").map((a) => a.id)).toEqual(["library"]);
  });
});

describe("inhabitedModules", () => {
  it("drops shelves no App stands on", () => {
    const ids = inhabitedModules().map((m) => m.id);
    expect(ids).toContain("tasks");
    expect(ids).not.toContain("money");
  });

  it("keeps a Module whose only screens are hidden — the shelf exists, the row does not", () => {
    expect(inhabitedModules().map((m) => m.id)).toContain("progress");
  });
});

describe("navSectionsOf", () => {
  const sections = navSectionsOf(DASHBOARD_FRAME);

  it("puts loose screens first, then Modules in MODULES order", () => {
    expect(sections.map((s) => s.group?.id)).toEqual([undefined, "house", "tasks", "culture"]);
  });

  it("treats an App naming an unknown Module as loose", () => {
    expect(sections[0]!.screens.map((s) => s.id)).toEqual(["hub", "odd"]);
  });

  it("leaves out hidden screens, and Modules left empty by them", () => {
    expect(sections.flatMap((s) => s.screens).map((s) => s.id)).not.toContain("shelf-detail");
    expect(sections.map((s) => s.group?.id)).not.toContain("progress");
  });

  it("shelves each frame on its own", () => {
    expect(navSectionsOf(VAULT_FRAME).map((s) => s.screens.map((x) => x.id))).toEqual([["journal"]]);
  });

  it("restricts shelves to a Workspace's Modules, but never the loose screens", () => {
    const only = navSectionsOf(DASHBOARD_FRAME, ["culture"]);
    expect(only.map((s) => s.group?.id)).toEqual([undefined, "culture"]);
    expect(only[0]!.screens.map((s) => s.id)).toEqual(["hub", "odd"]);
  });
});

describe("moduleOfPath", () => {
  it("finds the Module of an App screen, detail routes included", () => {
    expect(moduleOfPath("/app/tasks")).toBe("tasks");
    expect(moduleOfPath("/app/library/shelf/42")).toBe("culture");
  });

  it("finds a Module by its own page", () => {
    expect(moduleOfPath("/module/house")).toBe("house");
  });

  it("puts the Vault in no Module: it is Core's raw editor (ADR 0068)", () => {
    expect(moduleOfPath("/vault/d/abc")).toBeUndefined();
  });

  it("is undefined for Core's destinations and for an App in no Module", () => {
    expect(moduleOfPath("/schedule")).toBeUndefined();
    expect(moduleOfPath("/base/task")).toBeUndefined();
    expect(moduleOfPath("/app/hub")).toBeUndefined();
    expect(moduleOfPath("/module/nonexistent")).toBeUndefined();
  });

  it("does not take a longer path that merely starts with a route", () => {
    expect(moduleOfPath("/app/tasksmith")).toBeUndefined();
  });
});

describe("moduleScreens", () => {
  it("lists a Module's listed Dashboard screens only", () => {
    expect(moduleScreens("culture").map((s) => s.id)).toEqual(["library"]);
    expect(moduleScreens("house").map((s) => s.id)).toEqual(["chores"]);
  });
});

describe("the World Module (ADR 0119)", () => {
  it("is the people Module, retitled: the id stays so stored Workspaces and phone bars keep it", () => {
    expect(MODULES.find((m) => m.id === "people")?.title).toBe("World");
    expect(MODULES.some((m) => m.title === "People")).toBe(false);
  });
});

describe("resetting a built-in type (ADR 0123: an option is never removed)", () => {
  const records = () => db().collection<DocumentTypeRecord>(DOCUMENT_TYPES).where("deleted").equals(0).toArray();
  const kinds = async () => (await records()).find((r) => r.typeId === "kinded")?.fields.find((f) => f.key === "kind")?.options?.map((o) => o.value);

  const labels = () => documentType("kinded")?.fields.find((f) => f.key === "kind")?.options?.map((o) => o.label);

  it("keeps the Kinds the user added", async () => {
    await saveFieldOptions("kinded", "kind", [{ value: "cafe", label: "Cafe" }, { label: "Bakery" }]);
    const rec = (await records()).find((r) => r.typeId === "kinded")!;
    await resetBuiltinType(rec);
    expect(await kinds()).toEqual(["bakery"]);
    await vi.waitFor(() => expect(labels()).toEqual(["Cafe", "Bakery"]));
  });

  it("puts back the App's name of a Kind the user renamed, and keeps the one they added", async () => {
    await db().table(DOCUMENT_TYPES).clear();
    await saveFieldOptions("kinded", "kind", [{ value: "cafe", label: "Coffee shop" }, { label: "Bakery" }]);
    await vi.waitFor(() => expect(labels()).toEqual(["Coffee shop", "Bakery"]));
    await resetBuiltinType((await records()).find((r) => r.typeId === "kinded")!);
    await vi.waitFor(() => expect(labels()).toEqual(["Cafe", "Bakery"]));
  });

  it("leaves the type unedited once reset, though it keeps the Kinds the user added", async () => {
    await db().table(DOCUMENT_TYPES).clear();
    await saveDocumentType({ typeId: "kinded", label: "Renamed", icon: "", folder: "", fields: [], order: 0 });
    await saveFieldOptions("kinded", "kind", [{ value: "cafe", label: "Coffee shop" }, { label: "Bakery" }]);
    await vi.waitFor(() => expect(documentType("kinded")?.overridden).toBe(true));
    await resetBuiltinType((await records()).find((r) => r.typeId === "kinded")!);
    await vi.waitFor(() => expect(labels()).toEqual(["Cafe", "Bakery"]));
    expect(documentType("kinded")?.label).toBe("Kinded");
    expect(documentType("kinded")?.overridden).toBeFalsy();
  });

  it("drops the override altogether when it holds nothing but the type's own settings", async () => {
    await db().table(DOCUMENT_TYPES).clear();
    const rec = await saveDocumentType({ typeId: "kinded", label: "Renamed", icon: "", folder: "", fields: [], order: 0 });
    await resetBuiltinType(rec);
    expect((await records()).some((r) => r.typeId === "kinded")).toBe(false);
  });
});
