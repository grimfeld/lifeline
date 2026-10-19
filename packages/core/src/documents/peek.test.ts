import { beforeEach, describe, expect, it, vi } from "vitest";
import { initApps } from "../registry";
import type { AppManifest } from "../manifest";
import type { Document, DocumentTypeDef } from "./types";
import { backPeek, closePeek, homeModuleOf, openDocument, openPeek, opensInPlace, peekStack, pushPeek } from "./peek";

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

describe("the Peek's back stack (ADR 0085)", () => {
  beforeEach(() => closePeek());

  it("opening a Peek from the page starts a new stack", () => {
    openPeek("a");
    pushPeek("b");
    openPeek("c");
    expect(peekStack()).toEqual(["c"]);
  });

  it("following a link inside a Peek replaces what it shows, and back returns", () => {
    openPeek("a");
    pushPeek("b");
    pushPeek("c");
    expect(peekStack()).toEqual(["a", "b", "c"]);
    backPeek();
    expect(peekStack()).toEqual(["a", "b"]);
    backPeek();
    expect(peekStack()).toEqual(["a"]);
  });

  it("back on the first Peek stays on it", () => {
    openPeek("a");
    backPeek();
    expect(peekStack()).toEqual(["a"]);
  });

  it("following a link to what is already shown changes nothing", () => {
    openPeek("a");
    pushPeek("a");
    expect(peekStack()).toEqual(["a"]);
  });

  it("closing clears the stack", () => {
    openPeek("a");
    pushPeek("b");
    closePeek();
    expect(peekStack()).toEqual([]);
  });

  it("a link followed with no Peek open starts one", () => {
    pushPeek("a");
    expect(peekStack()).toEqual(["a"]);
  });
});

describe("openDocument", () => {
  beforeEach(() => closePeek());
  const doc = { id: "t1", type: "transaction", title: "x" } as Document;

  it("inside a Peek, a link replaces what it shows — even one that would open in place", () => {
    const navigate = vi.fn();
    openPeek("a");
    openDocument(doc, { pathname: "/app/ledger", navigate, inPeek: true });
    expect(navigate).not.toHaveBeenCalled();
    expect(peekStack()).toEqual(["a", "t1"]);
  });

  it("from the page, it goes there in its Home Module and peeks anew elsewhere", () => {
    const navigate = vi.fn();
    openDocument(doc, { pathname: "/app/ledger", navigate });
    expect(navigate).toHaveBeenCalledOnce();
    openPeek("a");
    pushPeek("b");
    openDocument(doc, { pathname: "/vault", navigate });
    expect(peekStack()).toEqual(["t1"]);
  });
});
