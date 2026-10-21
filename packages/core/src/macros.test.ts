import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { commandNavigates, invokeCommand, type OwnedCommand } from "./commands";
import { db, openDb } from "./data/db";
import { putDocument } from "./documents/store";
import { MACRO_APP, macroCommand, moveStep, onMacroReport, removeStep, runMacro, withMacros, type MacroReport, type MacroStep, type StepArg } from "./macros";
import type { CommandArg, CommandDef } from "./manifest";

/** A fake headless Command that records each run it is given, in `log`. */
function headless(appId: string, id: string, args: CommandArg[], log: string[], refuse?: string): CommandDef & { appId: string } {
  return {
    appId,
    id,
    title: `${appId} ${id}`,
    args,
    returnsDocument: true,
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

  it("is checked before its first step: a broken Macro records nothing and says why", async () => {
    const log: string[] = [];
    const commands = [headless("stats", "log", NOTE, log), headless("pocket", "spend", AMOUNT, log)];
    const report = await runMacro({ name: "M", steps: [fixed("stats/log", {}), fixed("pocket/spend", { amount: "lots" }), fixed("gone/away", {})] }, commands);
    expect(log).toEqual([]);
    expect(report).toEqual({
      name: "M",
      broken: ["Step 2: Amount: expected a number", "Step 3: “gone/away” no longer exists"],
      steps: [
        { title: "stats log", status: "not-reached" },
        { title: "pocket spend", status: "not-reached" },
        { title: "gone/away", status: "not-reached" },
      ],
    });
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
    openDb([], []);
    await db().open();
    const log: string[] = [];
    const ABOUT: CommandArg[] = [...NOTE, { key: "about", label: "About", kind: "link" }];
    // Step 1 makes a real Document, so step 2's link is read as any link is: by the store.
    const library: OwnedCommand = {
      ...headless("library", "add", NOTE, log),
      invoke: async () => ({ message: "Added", id: (await putDocument({ type: "book", title: "Dune", folder: "", tags: [] })).id }),
    };
    const commands = [library, headless("notes", "add", ABOUT, log)];
    const macro = { name: "Read", steps: [step("library/add", {}), step("notes/add", { about: { from: "step", step: 0 }, note: { from: "fixed", value: "x" } })] };
    const report = await runMacro(macro, commands);
    const made = report.steps[0].status === "done" ? report.steps[0].id : undefined;
    expect(made).toBeDefined();
    expect(log).toEqual([`notes/add {"note":"x","about":"${made}"}`]);
    expect(report.steps.map((s) => s.status)).toEqual(["done", "done"]);
  });

  it("stops at a step whose earlier step, though it says it returns a Document, made none", async () => {
    const log: string[] = [];
    const LINK: CommandArg[] = [{ key: "about", label: "About", kind: "link" }];
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
        return true;
      },
    });
    expect(order).toEqual(["opened reconcile after 1 step"]);
    expect(report.steps.map((s) => s.status)).toEqual(["done", "done", "done"]);
    expect(log).toHaveLength(2);
  });

  it("stops at a dialog-only step whose dialog is cancelled, reporting it cancelled", async () => {
    const log: string[] = [];
    const commands = [headless("stats", "log", NOTE, log), dialogOnly("ledger", "reconcile")];
    const report = await runMacro({ name: "M", steps: [step("stats/log", {}), step("ledger/reconcile", {}), step("stats/log", {})] }, commands, {
      openDialog: async () => false,
    });
    expect(report.steps.map((s) => s.status)).toEqual(["done", "stopped", "not-reached"]);
    expect(report.steps[1]).toEqual({ title: "ledger reconcile", status: "stopped", reason: "Cancelled" });
    expect(log).toHaveLength(1);
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

  it("is broken by a navigating step anywhere but last, so nothing runs", async () => {
    const went: string[] = [];
    const log: string[] = [];
    const report = await runMacro({ name: "M", steps: [step("hub/go.today", {}, { skipIfRefused: true }), step("stats/log", {})] }, [headless("stats", "log", NOTE, log), goTo("today")], {
      ctx: { navigate: (p) => went.push(p) },
    });
    expect(report.broken).toEqual(["Step 1: “Go to today” goes somewhere, so it must be the last step"]);
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
      openDialog: async () => true,
    };
    const commands = [headless("pocket", "spend", AMOUNT, log), headless("stats", "log", NOTE, log)];
    const def = macroCommand({ id: "m", name: "Tea", steps: [step("pocket/spend", { amount: { from: "asked" } }), step("stats/log", { note: { from: "asked" } })] }, commands, () => ui);
    await def.run!({ navigate: () => {} });
    expect(asked).toEqual([["s1_amount", "s2_note"]]);
    expect(log).toEqual(['pocket/spend {"amount":2}', 'stats/log {"note":"tea"}']);
  });

  it("hands what an inline line understood to the asked form as its starting values", async () => {
    const log: string[] = [];
    const seen: unknown[] = [];
    const ui = {
      ask: async (_m: unknown, _args: CommandArg[], initial?: Record<string, unknown>) => {
        seen.push(initial);
        return { s1_amount: "3" };
      },
      openDialog: async () => true,
    };
    const def = macroCommand({ id: "m", name: "Coffee", steps: [step("pocket/spend", { amount: { from: "asked" } })] }, [headless("pocket", "spend", AMOUNT, log)], () => ui);
    await def.run!({ navigate: () => {}, initial: { s1_amount: "3" } });
    expect(seen).toEqual([{ s1_amount: "3" }]);
    expect(log).toEqual(['pocket/spend {"amount":3}']);
  });

  it("runs nothing when the asked form is cancelled", async () => {
    const log: string[] = [];
    const reports: MacroReport[] = [];
    const stop = onMacroReport((r) => reports.push(r));
    const def = macroCommand({ id: "m", name: "Tea", steps: [step("pocket/spend", { amount: { from: "asked" } })] }, [headless("pocket", "spend", AMOUNT, log)], () => ({
      ask: async () => undefined,
      openDialog: async () => true,
    }));
    await def.run!({ navigate: () => {} });
    stop();
    expect(log).toEqual([]);
    expect(reports).toEqual([]);
  });
});

describe("a broken Macro as a Command", () => {
  const broken = (log: string[]) =>
    macroCommand(
      { id: "m", name: "Coffee", steps: [step("pocket/spend", { amount: { from: "asked" } }), step("pocket/spend", { amount: { from: "fixed", value: "lots" } })] },
      [headless("pocket", "spend", AMOUNT, log)],
      () => ({
        ask: async () => {
          log.push("asked");
          return { s1_amount: 3 };
        },
        openDialog: async () => true,
      }),
    );

  it("refuses to run headless, saying why", async () => {
    const log: string[] = [];
    await expect(invokeCommand(broken(log), { s1_amount: "3" })).rejects.toThrow("“Coffee” is broken: Step 2: Amount: expected a number");
    expect(log).toEqual([]);
  });

  it("from the palette, asks nothing and reports why it is broken", async () => {
    const log: string[] = [];
    const reports: MacroReport[] = [];
    const stop = onMacroReport((r) => reports.push(r));
    await broken(log).run!({ navigate: () => {} });
    stop();
    expect(log).toEqual([]);
    expect(reports.map((r) => r.broken)).toEqual([["Step 2: Amount: expected a number"]]);
  });
});

describe("the registry a Macro is checked and run against", () => {
  it("holds the Macros too, so a Macro taking another as a step is refused as one, not as gone", async () => {
    const log: string[] = [];
    const inner = { id: "a", name: "Inner", sort: 0, steps: [step("stats/log", {})] };
    const outer = { id: "b", name: "Outer", sort: 1, steps: [step(`${MACRO_APP}/a`, {})] };
    // Outer first: what it names is listed after it.
    const registry = withMacros([headless("stats", "log", NOTE, log)], [outer, inner]);
    expect(registry.map((c) => `${c.appId}/${c.id}`)).toEqual(["stats/log", `${MACRO_APP}/b`, `${MACRO_APP}/a`]);
    const reports: MacroReport[] = [];
    const stop = onMacroReport((r) => reports.push(r));
    await registry[1].run!({ navigate: () => {} });
    stop();
    expect(reports.map((r) => r.broken)).toEqual([["Step 1: “Inner” is a Macro, and a Macro cannot be a step"]]);
    expect(log).toEqual([]);
  });
});

describe("editing the steps", () => {
  const link = (n: number): StepArg => ({ from: "step", step: n });
  const steps = (): MacroStep[] => [step("a/a", {}), step("b/b", { x: link(0) }), step("c/c", { x: link(1), y: link(0) })];

  it("moving a step keeps each reference on the step it names", () => {
    const moved = moveStep(steps(), 0, 1);
    expect(moved.map((s) => s.command)).toEqual(["b/b", "a/a", "c/c"]);
    expect(moved[0].args.x).toEqual(link(1));
    expect(moved[2].args).toEqual({ x: link(0), y: link(1) });
  });

  it("removing a step renumbers the references after it, and empties those that named it", () => {
    const left = removeStep(steps(), 1);
    expect(left.map((s) => s.command)).toEqual(["a/a", "c/c"]);
    expect(left[1].args).toEqual({ x: { from: "fixed", value: undefined }, y: link(0) });
    expect(removeStep(steps(), 0)).toEqual([step("b/b", { x: { from: "fixed", value: undefined } }), step("c/c", { x: link(0), y: { from: "fixed", value: undefined } })]);
  });
});
