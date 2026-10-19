import { describe, expect, it } from "vitest";
import { initApps } from "../registry";
import type { AppManifest } from "../manifest";
import type { DocumentTypeDef } from "./types";
import { homeModuleOf, opensInPlace } from "./peek";

const type = (id: string): DocumentTypeDef => ({ id, label: id, titleRule: "name", body: "optional", fields: [], builtIn: true });

const app = (id: string, module: string | undefined, typeId: string): AppManifest => ({
  id,
  title: id,
  module,
  types: [type(typeId)],
  screens: [{ id: `${id}.main`, title: id, path: id, component: () => null }],
  cards: [],
  commands: [],
});

initApps([app("ledger", "money", "transaction"), app("notes", "journal", "daily"), app("calendar", undefined, "event")]);

describe("homeModuleOf", () => {
  it("is the owning App's Module", () => {
    expect(homeModuleOf({ type: "transaction" })).toBe("money");
    expect(homeModuleOf({ type: "daily" })).toBe("journal");
  });

  it("is undefined for an App in no Module, and for a type no App owns", () => {
    expect(homeModuleOf({ type: "event" })).toBeUndefined();
    expect(homeModuleOf({ type: "user-defined-thing" })).toBeUndefined();
  });
});

describe("opensInPlace", () => {
  it("goes straight to a Document from inside its Home Module", () => {
    expect(opensInPlace({ type: "transaction" }, "/app/ledger")).toBe(true);
    expect(opensInPlace({ type: "transaction" }, "/module/money")).toBe(true);
    expect(opensInPlace({ type: "daily" }, "/app/notes")).toBe(true);
  });

  it("peeks from another Module, a general Surface or a Base", () => {
    expect(opensInPlace({ type: "transaction" }, "/vault/d/abc")).toBe(false);
    expect(opensInPlace({ type: "daily" }, "/app/ledger")).toBe(false);
    expect(opensInPlace({ type: "transaction" }, "/calendar")).toBe(false);
    expect(opensInPlace({ type: "transaction" }, "/base/transaction")).toBe(false);
  });

  it("peeks from the Vault, which is no Module's (ADR 0068)", () => {
    expect(opensInPlace({ type: "daily" }, "/vault/d/abc")).toBe(false);
  });

  it("always peeks a Document with no Home Module", () => {
    expect(opensInPlace({ type: "event" }, "/calendar")).toBe(false);
  });
});
