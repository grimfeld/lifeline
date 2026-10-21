import { describe, expect, it } from "vitest";
import { invokeCommand } from "./commands";
import { MACRO_APP, commandNavigates, macroCommand, onMacroReport, runMacro, type MacroReport, type MacroStep, type OwnedCommand, type StepArg } from "./macros";
import type { CommandArg, CommandDef } from "./manifest";

/** A fake headless Command that records each run it is given, in `log`. */
function headless(appId: string, id: string, args: CommandArg[], log: string[], refuse?: string): CommandDef & { appId: string } {
  return {
    appId,
    id,
    title: `${appId} ${id}`,
    args,
    invoke: async (a) => {
      if (refuse) throw new Error(refuse);
      log.push(`${appId}/${id} ${JSON.stringify(a)}`);
      return { message: `Did ${id}`, id: `${id}-doc` };
    },
  };
}

const AMOUNT: CommandArg[] = [{ key: "amount", label: "Amount", kind: "number", required: true }];
const NOTE: CommandArg[] = [{ key: "note", label: "Note", kind: "text" }];

function fixed(command: string, args: Record<string, unknown>): MacroStep {
  return { command, args: Object.fromEntries(Object.entries(args).map(([k, value]) => [k, { from: "fixed", value }])) };
}

describe("runMacro", () => {
  it("runs each step in order through its own Command, with its fixed values read against the signature", async () => {
    const log: string[] = [];
    const commands = [headless("pocket", "spend", AMOUNT, log), headless("stats", "log", NOTE, log)];
    const report = await runMacro({ name: "Coffee", steps: [fixed("stats/log", { note: "coffee" }), fixed("pocket/spend", { amount: "3" })] }, commands);
    expect(log).toEqual(['stats/log {"note":"coffee"}', 'pocket/spend {"amount":3}']);
    expect(report.steps).toEqual([
      { title: "stats log", status: "done", message: "Did log", id: "log-doc" },
      { title: "pocket spend", status: "done", message: "Did spend", id: "spend-doc" },
    ]);
  });

  it("stops at a refused step: what is done stays done, the rest is not reached", async () => {
    const log: string[] = [];
    const commands = [headless("stats", "log", NOTE, log), headless("mood", "set", NOTE, log, "Today already has a mood"), headless("pocket", "spend", AMOUNT, log)];
    const report = await runMacro({ name: "Morning", steps: [fixed("stats/log", {}), fixed("mood/set", {}), fixed("pocket/spend", { amount: 3 })] }, commands);
    expect(log).toEqual(["stats/log {}"]);
    expect(report.steps.map((s) => s.status)).toEqual(["done", "stopped", "not-reached"]);
    expect(report.steps[1]).toEqual({ title: "mood set", status: "stopped", reason: "Today already has a mood" });
  });

  it("stops at a value its Command's signature refuses, and at a Command that no longer exists", async () => {
    const log: string[] = [];
    const commands = [headless("pocket", "spend", AMOUNT, log)];
    expect((await runMacro({ name: "M", steps: [fixed("pocket/spend", { amount: "lots" })] }, commands)).steps[0]).toMatchObject({ status: "stopped", reason: "Amount: expected a number" });
    expect((await runMacro({ name: "M", steps: [fixed("gone/away", {})] }, commands)).steps[0]).toMatchObject({ title: "gone/away", status: "stopped" });
    expect(log).toEqual([]);
  });
});

describe("a Macro as a Command", () => {
  it("is listed by its name and, run, runs its steps and hands the report on", async () => {
    const log: string[] = [];
    const commands = [headless("pocket", "spend", AMOUNT, log)];
    const def = macroCommand({ id: "m1", name: "Coffee", steps: [fixed("pocket/spend", { amount: 3 })] }, commands);
    expect(def).toMatchObject({ appId: MACRO_APP, id: "m1", title: "Coffee" });
    const reports: MacroReport[] = [];
    const stop = onMacroReport((r) => reports.push(r));
    await def.run!({ navigate: () => {} });
    stop();
    expect(log).toEqual(['pocket/spend {"amount":3}']);
    expect(reports).toEqual([{ name: "Coffee", steps: [{ title: "pocket spend", status: "done", message: "Did spend", id: "spend-doc" }] }]);
  });
});

function step(command: string, args: Record<string, StepArg>, extra: Partial<MacroStep> = {}): MacroStep {
  return { command, args, ...extra };
}

describe("a step's arguments", () => {
  it("takes an asked argument from the answers, keyed by its step", async () => {
    const log: string[] = [];
    const commands = [headless("pocket", "spend", AMOUNT, log), headless("stats", "log", NOTE, log)];
    const macro = { name: "Coffee", steps: [step("pocket/spend", { amount: { from: "asked" } }), step("stats/log", { note: { from: "asked" } })] };
    await runMacro(macro, commands, { asked: { s1_amount: "4", s2_note: "flat white" } });
    expect(log).toEqual(['pocket/spend {"amount":4}', 'stats/log {"note":"flat white"}']);
  });

  it("links a later step to the Document an earlier step made", async () => {
    const log: string[] = [];
    // A text argument stands in for the link: what is checked is that step 1's Document id arrives.
    const ABOUT: CommandArg[] = [...NOTE, { key: "about", label: "About", kind: "text" }];
    const commands = [headless("library", "add", NOTE, log), headless("notes", "add", ABOUT, log)];
    const macro = { name: "Read", steps: [step("library/add", {}), step("notes/add", { about: { from: "step", step: 0 }, note: { from: "fixed", value: "x" } })] };
    const report = await runMacro(macro, commands);
    expect(log).toEqual(["library/add {}", 'notes/add {"note":"x","about":"add-doc"}']);
    expect(report.steps.map((s) => s.status)).toEqual(["done", "done"]);
  });

  it("stops at a step whose earlier step made nothing to link to", async () => {
    const log: string[] = [];
    const LINK: CommandArg[] = [{ key: "about", label: "About", kind: "text" }];
    const made = headless("stats", "log", NOTE, log);
    const commands = [{ ...made, invoke: async () => ({ message: "Logged" }) }, headless("notes", "add", LINK, log)];
    const report = await runMacro({ name: "M", steps: [step("stats/log", {}), step("notes/add", { about: { from: "step", step: 0 } })] }, commands);
    expect(report.steps[1]).toEqual({ title: "notes add", status: "stopped", reason: "Step 1 made no Document to link to" });
    expect(log).toEqual([]);
  });
});

describe("skip if refused", () => {
  it("reports a refused step marked skip-if-refused as skipped, with why, and carries on", async () => {
    const log: string[] = [];
    const commands = [headless("mood", "set", NOTE, log, "Today already has a mood"), headless("stats", "log", NOTE, log)];
    const report = await runMacro({ name: "Morning", steps: [step("mood/set", {}, { skipIfRefused: true }), step("stats/log", {})] }, commands);
    expect(report.steps).toEqual([
      { title: "mood set", status: "skipped", reason: "Today already has a mood" },
      { title: "stats log", status: "done", message: "Did log", id: "log-doc" },
    ]);
    expect(log).toEqual(["stats/log {}"]);
  });

  it("never skips a step whose Command no longer exists", async () => {
    const report = await runMacro({ name: "M", steps: [step("gone/away", {}, { skipIfRefused: true }), step("gone/too", {})] }, []);
    expect(report.steps.map((s) => s.status)).toEqual(["stopped", "not-reached"]);
  });
});

describe("dialog and navigation steps", () => {
  const Dialog = () => null;
  const dialogOnly = (appId: string, id: string): OwnedCommand => ({ appId, id, title: `${appId} ${id}`, dialog: Dialog });
  const goTo = (path: string): OwnedCommand => ({ appId: "hub", id: `go.${path}`, title: `Go to ${path}`, run: ({ navigate }) => navigate(path) });

  it("opens a dialog-only step's dialog at its turn, and goes on once it is closed", async () => {
    const order: string[] = [];
    const log: string[] = [];
    const commands = [headless("stats", "log", NOTE, log), dialogOnly("ledger", "reconcile")];
    const report = await runMacro({ name: "M", steps: [step("stats/log", {}), step("ledger/reconcile", {}), step("stats/log", {})] }, commands, {
      openDialog: async (def) => {
        order.push(`opened ${def.id} after ${log.length} step`);
      },
    });
    expect(order).toEqual(["opened reconcile after 1 step"]);
    expect(report.steps.map((s) => s.status)).toEqual(["done", "done", "done"]);
    expect(log).toHaveLength(2);
  });

  it("runs a navigating step last, taking the user there", async () => {
    const went: string[] = [];
    const log: string[] = [];
    const report = await runMacro({ name: "Morning", steps: [step("stats/log", {}), step("hub/go.today", {})] }, [headless("stats", "log", NOTE, log), goTo("today")], {
      ctx: { navigate: (p) => went.push(p) },
    });
    expect(went).toEqual(["today"]);
    expect(report.steps.map((s) => s.status)).toEqual(["done", "done"]);
  });

  it("refuses a navigating step anywhere but last, even when it may be skipped", async () => {
    const went: string[] = [];
    const log: string[] = [];
    const report = await runMacro({ name: "M", steps: [step("hub/go.today", {}, { skipIfRefused: true }), step("stats/log", {})] }, [headless("stats", "log", NOTE, log), goTo("today")], {
      ctx: { navigate: (p) => went.push(p) },
    });
    expect(report.steps[0]).toMatchObject({ status: "stopped", reason: "A step that goes somewhere must be the last" });
    expect(went).toEqual([]);
    expect(log).toEqual([]);
  });

  it("knows a run-only Command navigates unless it says it doesn't", () => {
    expect(commandNavigates(goTo("today"))).toBe(true);
    expect(commandNavigates({ ...goTo("today"), navigates: false })).toBe(false);
    expect(commandNavigates(dialogOnly("ledger", "reconcile"))).toBe(false);
    expect(commandNavigates(headless("stats", "log", NOTE, []))).toBe(false);
  });
});

describe("a Macro's headless form", () => {
  const Dialog = () => null;

  it("is headless exactly when every step is, its arguments being the asked ones, namespaced per step", () => {
    const log: string[] = [];
    const commands = [headless("pocket", "spend", AMOUNT, log), headless("stats", "log", [...NOTE, ...AMOUNT], log), { appId: "ledger", id: "x", title: "X", dialog: Dialog }];
    const coffee = macroCommand({ id: "m", name: "Coffee", steps: [step("pocket/spend", { amount: { from: "asked" } }), step("stats/log", { note: { from: "fixed", value: "coffee" }, amount: { from: "asked" } })] }, commands);
    expect(coffee.args?.map((a) => [a.key, a.label, a.required])).toEqual([
      ["s1_amount", "Amount (step 1)", true],
      ["s2_amount", "Amount (step 2)", true],
    ]);
    expect(coffee.invoke).toBeDefined();
    const mixed = macroCommand({ id: "n", name: "Mixed", steps: [step("pocket/spend", { amount: { from: "asked" } }), step("ledger/x", {})] }, commands);
    expect(mixed.args).toBeUndefined();
    expect(mixed.invoke).toBeUndefined();
  });

  it("keeps an asked argument's own label when no other step asks one like it", () => {
    const def = macroCommand({ id: "m", name: "Coffee", steps: [step("pocket/spend", { amount: { from: "asked" } })] }, [headless("pocket", "spend", AMOUNT, [])]);
    expect(def.args?.map((a) => [a.key, a.label])).toEqual([["s1_amount", "Amount"]]);
  });

  it("runs headless with its asked arguments, checked against its signature, and reports", async () => {
    const log: string[] = [];
    const def = macroCommand({ id: "m", name: "Coffee", steps: [step("pocket/spend", { amount: { from: "asked" } })] }, [headless("pocket", "spend", AMOUNT, log)]);
    await expect(invokeCommand(def, {})).rejects.toThrow("Amount is required");
    const reports: MacroReport[] = [];
    const stop = onMacroReport((r) => reports.push(r));
    const result = await invokeCommand(def, { s1_amount: "3" });
    stop();
    expect(log).toEqual(['pocket/spend {"amount":3}']);
    expect(result.message).toBe("Coffee: 1. pocket spend: Did spend");
    expect(reports).toHaveLength(1);
  });

  it("run from the palette, asks every asked argument in one form before the first step", async () => {
    const log: string[] = [];
    const asked: string[][] = [];
    const ui = {
      ask: async (_m: unknown, args: CommandArg[]) => {
        asked.push(args.map((a) => a.key));
        expect(log).toEqual([]);
        return { s1_amount: "2", s2_note: "tea" };
      },
      openDialog: async () => {},
    };
    const commands = [headless("pocket", "spend", AMOUNT, log), headless("stats", "log", NOTE, log)];
    const def = macroCommand({ id: "m", name: "Tea", steps: [step("pocket/spend", { amount: { from: "asked" } }), step("stats/log", { note: { from: "asked" } })] }, commands, () => ui);
    await def.run!({ navigate: () => {} });
    expect(asked).toEqual([["s1_amount", "s2_note"]]);
    expect(log).toEqual(['pocket/spend {"amount":2}', 'stats/log {"note":"tea"}']);
  });

  it("runs nothing when the asked form is cancelled", async () => {
    const log: string[] = [];
    const reports: MacroReport[] = [];
    const stop = onMacroReport((r) => reports.push(r));
    const def = macroCommand({ id: "m", name: "Tea", steps: [step("pocket/spend", { amount: { from: "asked" } })] }, [headless("pocket", "spend", AMOUNT, log)], () => ({
      ask: async () => undefined,
      openDialog: async () => {},
    }));
    await def.run!({ navigate: () => {} });
    stop();
    expect(log).toEqual([]);
    expect(reports).toEqual([]);
  });
});
