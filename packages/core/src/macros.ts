import { useLiveQuery } from "dexie-react-hooks";
import { invokeCommand } from "./commands";
import { db, MACROS, type SyncedRecord } from "./data/db";
import { put, remove } from "./data/repo";
import { newId } from "./ids";
import type { CommandDef } from "./manifest";

/**
 * Macros (CONTEXT.md "Macro", ADR 0092): a user-made Command whose steps are
 * other Commands, run in order, each through the App that owns it. Pure over
 * Command definitions — the caller hands in the registry's Commands.
 */

/** A Command as the registry lists it: with the App that owns it. */
export type OwnedCommand = CommandDef & { appId: string };

/**
 * Where one argument of a step gets its value. Only `fixed` for now; asked
 * (once, before the first step) and "what step N made" join it as further
 * `from` kinds (ADR 0092).
 */
export type StepArg = { from: "fixed"; value: unknown };

/** One step: a Command, named `appId/commandId` like a capture pin, and a source for each argument it is given. */
export interface MacroStep {
  command: string;
  args: Record<string, StepArg>;
}

/** What a Macro run needs of a Macro. */
export interface MacroShape {
  name: string;
  steps: MacroStep[];
}

/** One step of a run: done (what it said and made), stopped at it (why), or never reached. */
export type StepOutcome = { status: "done"; message: string; id?: string } | { status: "stopped"; reason: string } | { status: "not-reached" };

export type StepReport = StepOutcome & { title: string };

/** What every Macro run ends with (ADR 0092): each step, in order. */
export interface MacroReport {
  name: string;
  steps: StepReport[];
}

/** The `appId/commandId` key a step names its Command by. */
export function stepKey(c: Pick<OwnedCommand, "appId" | "id">): string {
  return `${c.appId}/${c.id}`;
}

function findCommand(commands: readonly OwnedCommand[], key: string): OwnedCommand | undefined {
  return commands.find((c) => stepKey(c) === key);
}

/** The values a step gives its Command. */
function stepValues(step: MacroStep): Record<string, unknown> {
  return Object.fromEntries(Object.entries(step.args).map(([k, a]) => [k, a.value]));
}

/**
 * Run a Macro: each step in order through `invokeCommand`, so its App checks
 * and records it as its own dialog would. A refused step stops the Macro
 * there; what is done stays done (nothing is rolled back).
 */
export async function runMacro(macro: MacroShape, commands: readonly OwnedCommand[]): Promise<MacroReport> {
  const steps: StepReport[] = [];
  let stopped = false;
  for (const step of macro.steps) {
    const def = findCommand(commands, step.command);
    const title = def?.title ?? step.command;
    if (stopped) {
      steps.push({ title, status: "not-reached" });
      continue;
    }
    try {
      if (!def) throw new Error("This Command no longer exists");
      const result = await invokeCommand(def, stepValues(step));
      steps.push({ title, status: "done", message: result.message, ...(result.id ? { id: result.id } : {}) });
    } catch (e) {
      stopped = true;
      steps.push({ title, status: "stopped", reason: e instanceof Error ? e.message : String(e) });
    }
  }
  return { name: macro.name, steps };
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

/**
 * A Macro as a Command like any other: in the palette by its name, under
 * Core's own `MACRO_APP`. Picking it runs its steps, then hands the report on
 * to whoever shows it — every run ends with one (ADR 0092).
 */
export function macroCommand(macro: MacroShape & { id: string }, commands: readonly OwnedCommand[]): OwnedCommand {
  return {
    appId: MACRO_APP,
    id: macro.id,
    title: macro.name,
    keywords: ["macro"],
    run: async () => {
      const report = await runMacro(macro, commands);
      reportListeners.forEach((l) => l(report));
    },
  };
}

// --- persistence -----------------------------------------------------------

/** A saved Macro: synced, global Core bookkeeping like a View (no Workspace). */
export interface MacroRecord extends SyncedRecord, MacroShape {
  sort: number;
}

/** Every living Macro, in the user's order. */
export function useMacros(): MacroRecord[] {
  return useLiveQuery(async () => (await db().collection<MacroRecord>(MACROS).where("deleted").equals(0).toArray()).sort((a, b) => a.sort - b.sort), [], [] as MacroRecord[]);
}

/** Every living Macro, read once (for a caller outside React). */
export async function allMacros(): Promise<MacroRecord[]> {
  return (await db().collection<MacroRecord>(MACROS).where("deleted").equals(0).toArray()).sort((a, b) => a.sort - b.sort);
}

/** Create (no `id`) or overwrite a Macro. A new one goes last. */
export async function saveMacro(input: MacroShape & { id?: string; sort?: number }): Promise<MacroRecord> {
  const { id, sort, ...rest } = input;
  const existing = id ? await db().collection<MacroRecord>(MACROS).get(id) : undefined;
  const order = sort ?? existing?.sort ?? Math.max(0, ...(await allMacros()).map((m) => m.sort + 1));
  const rec: MacroRecord = { ...rest, id: id ?? newId(), sort: order, updatedAt: "", deleted: 0 };
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
