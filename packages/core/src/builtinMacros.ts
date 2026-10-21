import { currentAccount } from "./data/account";
import { db, MACROS } from "./data/db";
import { hasPulledOnce } from "./data/sync";
import { newId } from "./ids";
import { allMacros, saveMacro, type MacroRecord, type MacroShape } from "./macros";

/**
 * Built-in Macros (CONTEXT.md "Macro", ADR 0092): defined here, and given to
 * each account once, as an ordinary Macro of its own carrying its `builtin`
 * id. From then on it is the user's: edited, reset to how it shipped, or
 * deleted for good. A later release changes this definition only — never a
 * copy already given.
 *
 * "Already given" is the Macro row itself (ADR 0094). A synced row is never
 * purged, only tombstoned, so a deleted built-in leaves a `deleted: 1` row
 * carrying its `builtin` id on the server and, after a pull, on every device:
 * that row, living or dead, is the per-account record that it was handed over.
 */
export interface BuiltinMacro extends MacroShape {
  builtin: string;
}

export const BUILTIN_MACROS: readonly BuiltinMacro[] = [
  {
    builtin: "morning",
    name: "Morning",
    steps: [
      // Asked each morning; already set today, it is skipped and the Macro goes on.
      { command: "mood/mood.set", args: { mood: { from: "asked" } }, skipIfRefused: true },
      { command: "hub/hub.go-today", args: {} },
    ],
  },
];

/**
 * The id a built-in is seeded under on a signed-in account: the same on
 * every device, so two devices seeding at once write one row, not two. A
 * signed-out device has no account to derive it from and takes a fresh one.
 */
function builtinId(builtin: string): string {
  const account = currentAccount();
  if (!account) return newId();
  const key = `${account.id}:${builtin}`;
  // Two FNV-1a passes, 7 base-36 digits each: 15 lowercase characters, as a PocketBase id must be.
  const fnv = (seed: number) => {
    let h = seed;
    for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 0x01000193) >>> 0;
    return (h % 36 ** 7).toString(36).padStart(7, "0");
  };
  return `b${fnv(0x811c9dc5)}${fnv(0x01234567)}`;
}

let ensuring: Promise<void> | null = null;

/**
 * Give the account every built-in it has never been given. Waits, like the
 * first Workspace (ensureDefaultWorkspace), for the `macros` collection to
 * have been pulled once: a device signing in before then would know neither
 * the copy another device was given nor its tombstone. One call at a time.
 */
export function ensureBuiltinMacros(builtins: readonly BuiltinMacro[] = BUILTIN_MACROS): Promise<void> {
  ensuring ??= seed(builtins).finally(() => {
    ensuring = null;
  });
  return ensuring;
}

async function seed(builtins: readonly BuiltinMacro[]): Promise<void> {
  if (!(await hasPulledOnce(MACROS))) return;
  // Tombstones included: a deleted built-in was given all the same.
  const given = new Set((await db().collection<MacroRecord>(MACROS).toArray()).flatMap((m) => (m.builtin ? [m.builtin] : [])));
  for (const b of builtins) {
    if (given.has(b.builtin)) continue;
    await saveMacro({ id: builtinId(b.builtin), builtin: b.builtin, name: b.name, steps: structuredClone(b.steps) });
  }
}

/**
 * "Reset to default": a built-in's name and steps as they ship now, in the
 * same Macro and place. Returns the Macro as it was, for Undo; undefined (and
 * nothing done) for a Macro that is no built-in.
 */
export async function resetMacro(id: string, builtins: readonly BuiltinMacro[] = BUILTIN_MACROS): Promise<MacroRecord | undefined> {
  const before = (await allMacros()).find((m) => m.id === id);
  const shipped = builtins.find((b) => b.builtin === before?.builtin);
  if (!before || !shipped) return undefined;
  await saveMacro({ ...before, name: shipped.name, steps: structuredClone(shipped.steps) });
  return before;
}

/** The built-in a Macro was given as, if it still ships. */
export function builtinOf(macro: Pick<MacroRecord, "builtin">, builtins: readonly BuiltinMacro[] = BUILTIN_MACROS): BuiltinMacro | undefined {
  return macro.builtin ? builtins.find((b) => b.builtin === macro.builtin) : undefined;
}
