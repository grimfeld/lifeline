import { useLiveQuery } from "dexie-react-hooks";
import { commandKey, commandNavigates, commandRun, invokeCommand, isInvocable, readCommandArgs, type OwnedCommand } from "./commands";
import { db, MACROS, type SyncedRecord } from "./data/db";
import { put, remove } from "./data/repo";
import { newId } from "./ids";
import { checkMacro, type DocumentLookup } from "./macroCheck";
import type { CommandArg, CommandCtx } from "./manifest";

/**
 * Macros (CONTEXT.md "Macro", ADR 0092): a user-made Command whose steps are
 * other Commands, run in order, each through the App that owns it. Pure over
 * Command definitions — the caller hands in the registry's Commands.
 */

/**
 * Where one argument of a step gets its value (ADR 0092): fixed in the Macro,
 * asked when it runs (all at once, before the first step), or the Document an
 * earlier step made — `step` is that step's index.
 */
export type StepArg = { from: "fixed"; value: unknown } | { from: "asked" } | { from: "step"; step: number };

/** One step: a Command, named `appId/commandId` like a capture pin, and a source for each argument it is given. */
export interface MacroStep {
  command: string;
  args: Record<string, StepArg>;
  /** Refused, the step is reported skipped and the Macro carries on (today's mood already set). */
  skipIfRefused?: boolean;
}

/** What a Macro run needs of a Macro. */
export interface MacroShape {
  name: string;
  steps: MacroStep[];
}

/** One step of a run: done (what it said and made), skipped or stopped at it (why), or never reached. */
export type StepOutcome =
  | { status: "done"; message: string; id?: string }
  | { status: "skipped"; reason: string }
  | { status: "stopped"; reason: string }
  | { status: "not-reached" };

export type StepReport = StepOutcome & { title: string };

/** What every Macro run ends with (ADR 0092): each step, in order — every one not reached when the Macro is broken. */
export interface MacroReport {
  name: string;
  steps: StepReport[];
  /** Set when the check before the first step failed (`checkMacro`): its reasons. Then nothing ran. */
  broken?: string[];
}

function findCommand(commands: readonly OwnedCommand[], key: string): OwnedCommand | undefined {
  return commands.find((c) => commandKey(c) === key);
}

/** The key an asked argument goes by in the Macro's own signature: namespaced by its step (1-based), so two steps may ask an `amount` each. */
export function askedKey(stepIndex: number, key: string): string {
  return `s${stepIndex + 1}_${key}`;
}

/**
 * A Macro's own signature: every argument its steps leave to be asked, in
 * step order, keyed per step. A label two steps share names its step.
 */
export function macroArgs(macro: MacroShape, commands: readonly OwnedCommand[]): CommandArg[] {
  const asked = macro.steps.flatMap((step, i) => {
    const def = findCommand(commands, step.command);
    return Object.entries(step.args).flatMap(([key, src]) => {
      const arg = src.from === "asked" ? def?.args?.find((a) => a.key === key) : undefined;
      return arg && def ? [{ arg, i, def }] : [];
    });
  });
  const shared = (label: string) => asked.filter((x) => x.arg.label === label).length > 1;
  return asked.map(({ arg, i, def }) => ({
    ...arg,
    key: askedKey(i, arg.key),
    label: shared(arg.label) ? `${arg.label} (step ${i + 1})` : arg.label,
    hint: `${arg.hint ? `${arg.hint} ` : ""}For step ${i + 1}, “${def.title}”.`,
  }));
}

/**
 * Move step `i` by one place, each "what step N made" following the step it names.
 * Generic over the step's own shape, so the editor's drafts move the same way.
 */
export function moveStep<S extends Pick<MacroStep, "args">>(steps: readonly S[], i: number, by: -1 | 1): S[] {
  const j = i + by;
  if (i < 0 || i >= steps.length || j < 0 || j >= steps.length) return [...steps];
  const next = [...steps];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return renumber(next, (n) => (n === i ? j : n === j ? i : n));
}

/** Remove step `i`: references to later steps move down one, and one that named it is left empty (fixed, no value). */
export function removeStep<S extends Pick<MacroStep, "args">>(steps: readonly S[], i: number): S[] {
  return renumber(
    steps.filter((_, k) => k !== i),
    (n) => (n === i ? undefined : n > i ? n - 1 : n),
  );
}

function renumber<S extends Pick<MacroStep, "args">>(steps: S[], to: (n: number) => number | undefined): S[] {
  return steps.map((s) => ({
    ...s,
    args: Object.fromEntries(
      Object.entries(s.args).map(([k, a]): [string, StepArg] => {
        if (a.from !== "step") return [k, a];
        const n = to(a.step);
        return [k, n === undefined ? { from: "fixed", value: undefined } : { from: "step", step: n }];
      }),
    ),
  }));
}

/** Headless exactly when every step is (ADR 0092): then it runs with its asked arguments alone, from an agent or an inline line. */
export function isMacroHeadless(macro: MacroShape, commands: readonly OwnedCommand[]): boolean {
  return macro.steps.length > 0 && macro.steps.every((s) => {
    const def = findCommand(commands, s.command);
    return !!def && isInvocable(def);
  });
}

/** What a run is handed: the asked answers, and — where a person is there — a way to go places and to open a step's dialog. */
export interface RunOptions {
  /** Answers to the asked arguments, by their `askedKey`. */
  asked?: Record<string, unknown>;
  /** Where the run can take the user, for a step that goes somewhere. */
  ctx?: CommandCtx;
  /** Opens a dialog-only step's dialog; resolves once it is closed, with whether it was done (false: cancelled). */
  openDialog?: (def: OwnedCommand) => Promise<boolean>;
  /** Where the check looks up fixed links; the local store by default. */
  lookup?: DocumentLookup;
}

/** The report of a Macro that did not start: every step not reached, and why it is broken. */
function brokenReport(macro: MacroShape, commands: readonly OwnedCommand[], reasons: string[]): MacroReport {
  const steps = macro.steps.map((s) => ({ title: findCommand(commands, s.command)?.title ?? s.command, status: "not-reached" as const }));
  return { name: macro.name, broken: reasons, steps };
}

/** The values a step gives its Command: fixed, answered, or what an earlier step made. */
function stepValues(step: MacroStep, index: number, asked: Record<string, unknown>, done: (StepOutcome | undefined)[]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(step.args).map(([k, a]) => {
      if (a.from === "fixed") return [k, a.value];
      if (a.from === "asked") return [k, asked[askedKey(index, k)]];
      const made = done[a.step];
      if (made?.status !== "done" || !made.id) throw new Error(`Step ${a.step + 1} made no Document to link to`);
      return [k, made.id];
    }),
  );
}

/** A step that stops the Macro whether or not it may be skipped: it could not run here, or the person cancelled it. */
class Broken extends Error {}

/** One step at its turn, as `commandRun` reads it: headless through `invokeCommand`, else its dialog or its `run`. */
async function runStep(def: OwnedCommand, step: MacroStep, index: number, opts: RunOptions, done: (StepOutcome | undefined)[]): Promise<StepOutcome> {
  switch (commandRun(def)) {
    case "headless": {
      const result = await invokeCommand(def, stepValues(step, index, opts.asked ?? {}, done));
      return { status: "done", message: result.message, ...(result.id ? { id: result.id } : {}) };
    }
    case "dialog":
      if (!opts.openDialog) throw new Broken(`“${def.title}” needs its dialog, and none can be opened here`);
      if (!(await opts.openDialog(def))) throw new Broken("Cancelled");
      return { status: "done", message: "Done in its dialog" };
    case "navigates":
    case "run":
      if (!opts.ctx) break;
      await def.run!(opts.ctx);
      return { status: "done", message: "Done" };
  }
  throw new Broken(`“${def.title}” cannot be run here`);
}

/**
 * Run a Macro: checked first (`checkMacro`), so a broken one runs nothing
 * and its report says why; then each step in order, so its App checks and records it as its
 * own dialog would — headless through `invokeCommand`, a dialog-only step in
 * its dialog at its turn. A refused step stops the Macro there, unless it may
 * be skipped; what is done stays done (nothing is rolled back).
 */
export async function runMacro(macro: MacroShape, commands: readonly OwnedCommand[], opts: RunOptions = {}): Promise<MacroReport> {
  const check = await checkMacro(macro, commands, opts.lookup);
  if (!check.ok) return brokenReport(macro, commands, check.reasons);
  const outcomes: (StepOutcome | undefined)[] = [];
  const steps: StepReport[] = [];
  let stopped = false;
  for (const [i, step] of macro.steps.entries()) {
    const def = findCommand(commands, step.command);
    const title = def?.title ?? step.command;
    let outcome: StepOutcome;
    if (stopped) outcome = { status: "not-reached" };
    else {
      try {
        if (!def) throw new Broken("This Command no longer exists");
        outcome = await runStep(def, step, i, opts, outcomes);
      } catch (e) {
        const reason = e instanceof Error ? e.message : String(e);
        const skip = step.skipIfRefused && !(e instanceof Broken);
        stopped = !skip;
        outcome = { status: skip ? "skipped" : "stopped", reason };
      }
    }
    outcomes.push(outcome);
    steps.push({ title, ...outcome });
  }
  return { name: macro.name, steps };
}

/** A report in one sentence, for a caller that shows no dialog (an agent). */
export function reportMessage(report: MacroReport): string {
  const line = report.steps.map((s, i) => `${i + 1}. ${s.title}: ${s.status === "done" ? s.message : s.status === "not-reached" ? "not reached" : `${s.status}, ${s.reason}`}`);
  return `${report.name}: ${line.join("; ")}`;
}

/**
 * A Macro is capture (CONTEXT.md "Macro") when every step's Command is capture
 * and none navigates. A step whose Command is gone makes it not capture.
 */
export function isCaptureMacro(macro: MacroShape, commands: readonly OwnedCommand[]): boolean {
  return (
    macro.steps.length > 0 &&
    macro.steps.every((s) => {
      const c = findCommand(commands, s.command);
      return !!c && !!c.capture && !commandNavigates(c);
    })
  );
}

/** The pseudo-App every Macro's Command is listed under: it is Core's, not any App's. */
export const MACRO_APP = "macros";

const reportListeners = new Set<(report: MacroReport) => void>();

/** Listen for every finished Macro run — the shell shows each report in a dialog. Returns the unsubscribe. */
export function onMacroReport(listener: (report: MacroReport) => void): () => void {
  reportListeners.add(listener);
  return () => {
    reportListeners.delete(listener);
  };
}

/** What a Macro run needs of the screen: the up-front form for its asked arguments, and a step's own dialog. The shell provides it. */
export interface MacroUi {
  /** Ask every asked argument at once; undefined when the person cancels (then nothing runs). */
  ask: (macro: MacroShape, args: CommandArg[], initial?: Record<string, unknown>) => Promise<Record<string, unknown> | undefined>;
  /** Open a dialog-only step's dialog; resolves once it is closed, with whether it was done (false: cancelled). */
  openDialog: (def: OwnedCommand) => Promise<boolean>;
}

let macroUi: MacroUi | undefined;

/** The shell hands Macros its screen (once, beside the palette). Returns the withdrawal. */
export function provideMacroUi(ui: MacroUi): () => void {
  macroUi = ui;
  return () => {
    if (macroUi === ui) macroUi = undefined;
  };
}

function report(r: MacroReport): MacroReport {
  reportListeners.forEach((l) => l(r));
  return r;
}

/**
 * A Macro as a Command like any other: in the palette by its name, under
 * Core's own `MACRO_APP`. Picking it asks its asked arguments in one form,
 * runs its steps, then hands the report on to whoever shows it — every run
 * ends with one (ADR 0092). Headless when every step is: its `args` are its
 * asked ones (`macroArgs`), and `invoke` runs it with them.
 */
export function macroCommand(macro: MacroShape & { id: string }, commands: readonly OwnedCommand[], ui: () => MacroUi | undefined = () => macroUi): OwnedCommand {
  const args = macroArgs(macro, commands);
  const def: OwnedCommand = {
    appId: MACRO_APP,
    id: macro.id,
    title: macro.name,
    keywords: ["macro"],
    capture: isCaptureMacro(macro, commands),
    run: async (ctx) => {
      // Broken, it asks nothing: the report says why at once.
      const check = await checkMacro(macro, commands);
      if (!check.ok) return void report(brokenReport(macro, commands, check.reasons));
      const screen = ui();
      let asked: Record<string, unknown> = {};
      if (args.length > 0) {
        const answers = await screen?.ask(macro, args, ctx.initial);
        if (!answers) return;
        asked = await readCommandArgs(args, answers);
      }
      report(await runMacro(macro, commands, { asked, ctx, openDialog: screen?.openDialog }));
    },
  };
  if (!isMacroHeadless(macro, commands)) return def;
  return { ...def, args, invoke: async (asked) => ({ message: reportMessage(report(await runMacroHeadless(macro, commands, asked))) }) };
}

/**
 * Run a headless Macro with its asked arguments, as an agent does, and hand
 * back its report: the arguments checked against its signature (`macroArgs`)
 * first. A Macro that is not headless, or broken, is refused with why — then
 * nothing ran.
 */
export async function runMacroHeadless(macro: MacroShape, commands: readonly OwnedCommand[], raw: Record<string, unknown>): Promise<MacroReport> {
  if (!isMacroHeadless(macro, commands)) throw new Error(`“${macro.name}” cannot be run without a dialog`);
  const asked = await readCommandArgs(macroArgs(macro, commands), raw);
  const r = await runMacro(macro, commands, { asked });
  if (r.broken) throw new Error(`“${macro.name}” is broken: ${r.broken.join("; ")}`);
  return r;
}

/**
 * The registry a Macro is checked and run against: the Apps' Commands and
 * every Macro as a Command (`macroCommand`) — one list, so a Macro naming
 * another as a step is refused as one wherever it is checked. Each Macro holds
 * the whole list, filled before any of them runs.
 */
export function withMacros(own: readonly OwnedCommand[], macros: readonly (MacroShape & { id: string })[]): OwnedCommand[] {
  const registry: OwnedCommand[] = [...own];
  registry.push(...macros.map((m) => macroCommand(m, registry)));
  return registry;
}

// --- persistence -----------------------------------------------------------

/** A saved Macro: synced, global Core bookkeeping like a View (no Workspace). */
export interface MacroRecord extends SyncedRecord, MacroShape {
  sort: number;
  /** The built-in it was given as (builtinMacros.ts); kept through every edit, so it can be reset and is never given twice. */
  builtin?: string;
}

/** Every living Macro, in the user's order, read once (for a caller outside React). */
export async function allMacros(): Promise<MacroRecord[]> {
  return (await db().collection<MacroRecord>(MACROS).where("deleted").equals(0).toArray()).sort((a, b) => a.sort - b.sort);
}

/** Every living Macro, in the user's order, kept live. */
export function useMacros(): MacroRecord[] {
  return useLiveQuery(allMacros, [], [] as MacroRecord[]);
}

/** Create (no `id`) or overwrite a Macro. A new one goes last; an overwritten one stays the built-in it was. */
export async function saveMacro(input: MacroShape & { id?: string; sort?: number; builtin?: string }): Promise<MacroRecord> {
  const { id, sort, builtin, ...rest } = input;
  const existing = id ? await db().collection<MacroRecord>(MACROS).get(id) : undefined;
  const order = sort ?? existing?.sort ?? Math.max(0, ...(await allMacros()).map((m) => m.sort + 1));
  const given = builtin ?? existing?.builtin;
  const rec: MacroRecord = { ...rest, ...(given ? { builtin: given } : {}), id: id ?? newId(), sort: order, updatedAt: "", deleted: 0 };
  await put<MacroRecord>(MACROS, rec);
  return rec;
}

/** Delete a Macro (a tombstone); returns what `restoreMacro` brings back, for the Undo toast (ADR 0079). */
export async function deleteMacro(id: string): Promise<MacroRecord | undefined> {
  const before = await db().collection<MacroRecord>(MACROS).get(id);
  await remove(MACROS, id);
  return before;
}

export async function restoreMacro(rec: MacroRecord): Promise<void> {
  await put<MacroRecord>(MACROS, { ...rec, deleted: 0 });
}
