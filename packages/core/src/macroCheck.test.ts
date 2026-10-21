import { describe, expect, it } from "vitest";
import { checkMacro, type DocumentLookup } from "./macroCheck";
import type { OwnedCommand } from "./commands";
import type { MacroStep } from "./macros";
import type { CommandArg } from "./manifest";

const AMOUNT: CommandArg[] = [{ key: "amount", label: "Amount", kind: "number", required: true }];
const SOURCE: CommandArg[] = [{ key: "source", label: "Source", kind: "link", linkType: "source" }];

const headless = (appId: string, id: string, args: CommandArg[]): OwnedCommand => ({
  appId,
  id,
  title: `${appId} ${id}`,
  args,
  returnsDocument: true,
  invoke: async () => ({ message: "ok", id: "doc" }),
});
const goTo: OwnedCommand = {
  appId: "hub",
  id: "go.today",
  title: "Go to Today",
  run: ({ navigate }) => navigate("/today"),
};
const dialogOnly: OwnedCommand = {
  appId: "ledger",
  id: "reconcile",
  title: "Reconcile",
  dialog: () => null,
};
const macro: OwnedCommand = {
  appId: "macros",
  id: "m2",
  title: "Coffee",
  run: async () => {},
};

/** A headless Command that makes nothing to take: setting a mood. */
const setsMood: OwnedCommand = { ...headless("mood", "set", []), returnsDocument: undefined };
const COMMANDS = [headless("pocket", "spend", AMOUNT), headless("notes", "add", SOURCE), headless("library", "add", []), goTo, dialogOnly, macro, setsMood];

/** Two Sources, one of them a title twice over. */
const lookup: DocumentLookup = {
  linkable: async (arg) =>
    arg.linkType === "source"
      ? [
          { id: "dune", type: "source", title: "Dune" },
          { id: "e1", type: "source", title: "Emma" },
          { id: "e2", type: "source", title: "Emma" },
        ]
      : [],
};

const check = (...steps: MacroStep[]) => checkMacro({ name: "M", steps }, COMMANDS, lookup);
const s = (command: string, args: MacroStep["args"] = {}): MacroStep => ({
  command,
  args,
});

describe("checkMacro", () => {
  it("passes a Macro whose every step can be given what it needs", async () => {
    expect(
      await check(
        s("pocket/spend", { amount: { from: "fixed", value: "3" } }),
        s("library/add"),
        s("notes/add", { source: { from: "step", step: 1 } }),
        s("notes/add", { source: { from: "fixed", value: "Dune" } }),
        s("pocket/spend", { amount: { from: "asked" } }),
        s("ledger/reconcile"),
        s("hub/go.today"),
      ),
    ).toEqual({ ok: true });
  });

  it("is broken with no steps", async () => {
    expect(await check()).toEqual({ ok: false, reasons: ["It has no steps"] });
  });

  it("is broken by a Command that no longer exists", async () => {
    expect(await check(s("gone/away"))).toEqual({
      ok: false,
      reasons: ["Step 1: “gone/away” no longer exists"],
    });
  });

  it("is broken by a Macro as a step", async () => {
    expect(await check(s("macros/m2"))).toEqual({
      ok: false,
      reasons: ["Step 1: “Coffee” is a Macro, and a Macro cannot be a step"],
    });
  });

  it("is broken by a step that goes somewhere anywhere but last", async () => {
    expect(await check(s("hub/go.today"), s("library/add"))).toEqual({
      ok: false,
      reasons: ["Step 1: “Go to Today” goes somewhere, so it must be the last step"],
    });
  });

  it("is broken by a value its Command does not take", async () => {
    expect(await check(s("library/add", { colour: { from: "asked" } }), s("ledger/reconcile", { x: { from: "fixed", value: 1 } }))).toEqual({
      ok: false,
      reasons: ["Step 1: “library add” takes no “colour”", "Step 2: “Reconcile” takes no “x”"],
    });
  });

  it("is broken by a fixed value that does not fit its argument", async () => {
    expect(await check(s("pocket/spend", { amount: { from: "fixed", value: "lots" } }))).toEqual({ ok: false, reasons: ["Step 1: Amount: expected a number"] });
  });

  it("is broken by a fixed link to no Document, or to several", async () => {
    expect(await check(s("notes/add", { source: { from: "fixed", value: "Gone" } }), s("notes/add", { source: { from: "fixed", value: "Emma" } }))).toEqual({
      ok: false,
      reasons: ["Step 1: Source: no source called “Gone”", "Step 2: Source: 2 sources are called “Emma”; pass one id: e1, e2"],
    });
  });

  it("is broken by a reference to a step that is not earlier", async () => {
    expect(await check(s("notes/add", { source: { from: "step", step: 0 } }), s("notes/add", { source: { from: "step", step: 5 } }))).toEqual({
      ok: false,
      reasons: [
        "Step 1: Source takes what step 1 made, but step 1 does not come before it",
        "Step 2: Source takes what step 6 made, but step 6 does not come before it",
      ],
    });
  });

  it("is broken by a reference to a step that makes no Document", async () => {
    expect(await check(s("ledger/reconcile"), s("notes/add", { source: { from: "step", step: 0 } }))).toEqual({
      ok: false,
      reasons: ["Step 2: Source takes what step 1 made, but “Reconcile” makes no Document"],
    });
  });

  it("is broken by a reference to a headless step whose Command returns no Document", async () => {
    expect(await check(s("mood/set"), s("notes/add", { source: { from: "step", step: 0 } }))).toEqual({
      ok: false,
      reasons: ["Step 2: Source takes what step 1 made, but “mood set” makes no Document"],
    });
  });

  it("is broken by a step's result given to an argument that is not a link", async () => {
    expect(await check(s("library/add"), s("pocket/spend", { amount: { from: "step", step: 0 } }))).toEqual({
      ok: false,
      reasons: ["Step 2: Amount takes what step 1 made, but only a link can take a Document"],
    });
  });

  it("is broken by a required value left without a source", async () => {
    expect(await check(s("pocket/spend"), s("pocket/spend", { amount: { from: "fixed", value: "" } }))).toEqual({
      ok: false,
      reasons: [
        "Step 1: Amount is required, and is neither fixed, asked nor taken from a step",
        "Step 2: Amount is required, and is neither fixed, asked nor taken from a step",
      ],
    });
  });

  it("checks the rows of a fixed rows value, links within them included", async () => {
    const lines: CommandArg = {
      key: "lines",
      label: "Lines",
      kind: "rows",
      of: [{ key: "price", label: "Price", kind: "number", required: true }, ...SOURCE],
    };
    const receipt = headless("prices", "receipt", [lines]);
    const fixedLines = (value: unknown) =>
      checkMacro(
        {
          name: "M",
          steps: [s("prices/receipt", { lines: { from: "fixed", value } })],
        },
        [receipt],
        lookup,
      );
    expect(await fixedLines([{ price: 2, source: "dune" }])).toEqual({
      ok: true,
    });
    expect(await fixedLines([{ price: "x" }, { source: "Gone" }])).toEqual({
      ok: false,
      reasons: [
        "Step 1: Lines, row 1: Price: expected a number",
        "Step 1: Lines, row 2: Price is required",
        "Step 1: Lines, row 2: Source: no source called “Gone”",
      ],
    });
  });
});
