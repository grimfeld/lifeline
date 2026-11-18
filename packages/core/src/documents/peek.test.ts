import { beforeEach, describe, expect, it, vi } from "vitest";
import { initApps } from "../registry";
import type { AppManifest } from "../manifest";
import type { Document, DocumentTypeDef } from "./types";
import { backPeek, closePeek, forgetTiming, homeModuleOf, noteTiming, onPeekClosed, openDocument, openPeek, opensInPlace, peekOrigin, peekStack, peekTapped, pushPeek, type TimingChange } from "./peek";

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

describe("what was tapped on the hours (#536)", () => {
  beforeEach(() => closePeek());
  const tapped = { kind: "timed" as const, item: { key: "calendar/e1@2026-11-10", appId: "calendar", itemId: "e1", title: "Dentist", date: "2026-11-10", start: "10:00", end: "11:00" } };

  it("is known while the Peek shows the Document it was opened on, and only then", () => {
    openPeek("e1", { tapped });
    expect(peekTapped()).toEqual(tapped);
    pushPeek("p1");
    expect(peekTapped(), "a link followed in the Peek shows another Document").toBeNull();
    backPeek();
    expect(peekTapped()).toEqual(tapped);
    closePeek();
    expect(peekTapped()).toBeNull();
  });

  it("is not known for a Peek opened from anywhere else", () => {
    openPeek("e1");
    expect(peekTapped()).toBeNull();
  });

  it("keeps the element it was opened from once closed, so the focus can go back to it", () => {
    const anchor = {} as HTMLElement;
    openPeek("e1", { tapped, anchor });
    closePeek();
    expect(peekOrigin().anchor).toBe(anchor);
  });
});

describe("one timing Undo on closing a Peek (#536, ADR 0056)", () => {
  beforeEach(() => closePeek());
  const closed = () => {
    const seen: TimingChange[][] = [];
    const stop = onPeekClosed((c) => seen.push(c));
    return { seen, stop };
  };
  const restore = vi.fn(async () => {});
  const change = (after: object, key = "event:e1") => noteTiming({ key, label: "Dentist", before: { date: "2026-11-10", start: "10:00" }, after, restore });

  it("hands over what changed, with its timing from before the first change", () => {
    const { seen, stop } = closed();
    openPeek("e1");
    change({ date: "2026-11-10", start: "10:15" });
    noteTiming({ key: "event:e1", label: "Dentist", before: { date: "2026-11-10", start: "10:15" }, after: { date: "2026-11-11", start: "10:15" }, restore });
    closePeek();
    stop();
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject([{ key: "event:e1", before: { date: "2026-11-10", start: "10:00" }, after: { date: "2026-11-11", start: "10:15" } }]);
  });

  it("hands over nothing when the timing was put back as it was", () => {
    const { seen, stop } = closed();
    openPeek("e1");
    change({ date: "2026-11-10", start: "10:15" });
    change({ start: "10:00", date: "2026-11-10" });
    closePeek();
    stop();
    expect(seen).toEqual([[]]);
  });

  it("forgets a change whose thing was deleted (deleting brings its own Undo)", () => {
    const { seen, stop } = closed();
    openPeek("e1");
    change({ date: "2026-11-12", start: "10:00" });
    forgetTiming("event:e1");
    closePeek();
    stop();
    expect(seen).toEqual([[]]);
  });

  it("notes nothing while no Peek is open", () => {
    const { seen, stop } = closed();
    change({ date: "2026-11-12", start: "10:00" });
    openPeek("e1");
    closePeek();
    stop();
    expect(seen).toEqual([[]]);
  });

  it("ends one Peek's changes when another Peek replaces it, and keeps those made across links followed inside it", () => {
    const { seen, stop } = closed();
    openPeek("e1");
    change({ date: "2026-11-12", start: "10:00" });
    pushPeek("e2");
    change({ date: "2026-11-13", start: "09:00" }, "event:e2");
    openPeek("e3");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.map((c) => c.key)).toEqual(["event:e1", "event:e2"]);
    closePeek();
    stop();
    expect(seen[1]).toEqual([]);
  });
});
