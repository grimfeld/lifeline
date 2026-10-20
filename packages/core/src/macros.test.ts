import { describe, expect, it } from "vitest";
import { MACRO_APP, macroCommand, onMacroReport, runMacro, type MacroReport, type MacroStep } from "./macros";
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
