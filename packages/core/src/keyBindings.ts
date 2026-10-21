import { useLiveQuery } from "dexie-react-hooks";
import { db, KEY_BINDINGS, type SyncedRecord } from "./data/db";
import { put, remove } from "./data/repo";
import { newId } from "./ids";
import { isApplePlatform } from "./keys";
import type { CommandDef } from "./manifest";

/**
 * Key bindings (CONTEXT.md "Key binding"): a key the user gave a Command, so
 * it runs without the palette. Core bookkeeping, synced and global like Views —
 * the same keys in every Workspace and on every desk. Desk only: the shell
 * listens for them only off the phone.
 *
 * A key is written as a **chord**, `Mod+Alt+Shift+J`: `Mod` is ⌘ on a Mac and
 * Ctrl elsewhere, so a binding made on one desk means the same key on another.
 * Every chord holds Mod — a key without it would be taken from the text being
 * typed, and Alt alone is how a Mac (and a French keyboard) types characters.
 */
export interface KeyBindingRecord extends SyncedRecord {
  /** The chord, `Mod+…` (see `chordOf`). */
  key: string;
  /** The Command, as `appId/commandId` (`commandKey`, as capture pins name it). */
  command: string;
}

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "defaultPrevented">;

const MODIFIER_KEYS = new Set(["Meta", "Control", "Alt", "Shift", "AltGraph", "CapsLock", "OS", "Fn"]);

/**
 * The chord a key press makes, or nothing when it cannot be one: no Mod, only a
 * modifier, a Mac's Ctrl (the text's, as in `isModShortcut`), or a key
 * something nearer the focus already took.
 */
export function chordOf(e: KeyLike, apple: boolean = isApplePlatform()): string | undefined {
  if (e.defaultPrevented || MODIFIER_KEYS.has(e.key)) return undefined;
  const mod = apple ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  if (!mod) return undefined;
  const parts = ["Mod"];
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(keyName(e));
  return parts.join("+");
}

/** The key itself: the letter or digit typed, else the one at its position (Alt and Shift change what is typed), else the key's name. */
function keyName(e: KeyLike): string {
  if (/^[a-z0-9]$/i.test(e.key)) return e.key.toUpperCase();
  const m = /^(?:Key([A-Z])|Digit([0-9]))$/.exec(e.code ?? "");
  if (m) return m[1] ?? m[2];
  return e.key.length === 1 ? e.key.toUpperCase() : e.key;
}

const KEY_SYMBOLS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Enter: "↵",
  Backspace: "⌫",
  Delete: "⌦",
  Escape: "Esc",
  " ": "Space",
};

/** A chord as the platform writes it: `⌥⇧⌘J` on a Mac, `Ctrl+Alt+Shift+J` elsewhere. */
export function chordLabel(chord: string, apple: boolean = isApplePlatform()): string {
  const parts = chord.split("+");
  // "Mod++" — the key is "+" itself.
  const key = chord.endsWith("++") ? "+" : parts[parts.length - 1];
  const mods = new Set(parts.slice(0, chord.endsWith("++") ? -2 : -1));
  const name = KEY_SYMBOLS[key] ?? key;
  if (apple) return `${mods.has("Alt") ? "⌥" : ""}${mods.has("Shift") ? "⇧" : ""}${mods.has("Mod") ? "⌘" : ""}${name}`;
  return [mods.has("Mod") ? "Ctrl" : "", mods.has("Alt") ? "Alt" : "", mods.has("Shift") ? "Shift" : "", name].filter(Boolean).join("+");
}

/** Keys Lifeline itself answers to, and what for. */
const LIFELINE_KEYS: Record<string, string> = {
  "Mod+K": "opens the palette",
  "Mod+E": "switches the editor between reading and editing",
  "Mod+.": "opens the selection menu",
  "Mod+Enter": "saves a form",
  ...Object.fromEntries(["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((n) => [`Mod+${n}`, `opens Module ${n} of the Workspace`])),
};

/** The browser's own keys: a page should not take them, and some it cannot. */
const BROWSER_KEYS = new Set([
  ...["A", "C", "V", "X", "Z", "Y", "F", "G", "H", "J", "D", "L", "N", "T", "W", "Q", "R", "P", "S", "O", "U", "M", "0", "+", "=", "-", "[", "]", ",", "Tab", "ArrowLeft", "ArrowRight"].map((k) => `Mod+${k}`),
  ...["Z", "G", "N", "T", "W", "R", "I", "J", "C", "B", "Delete", "Tab", "+", "="].map((k) => `Mod+Shift+${k}`),
  "Mod+Alt+I",
  "Mod+Alt+J",
  "Mod+Alt+C",
]);

/** Why a chord cannot be bound (CONTEXT.md "Key binding"), or nothing when it can. `except` is the binding being changed. */
export function keyRefusal(chord: string, bindings: readonly KeyBindingRecord[], except?: string): string | undefined {
  const label = chordLabel(chord);
  const lifeline = LIFELINE_KEYS[chord];
  if (lifeline) return `${label} is Lifeline's: it ${lifeline}.`;
  if (BROWSER_KEYS.has(chord)) return `${label} is the browser's.`;
  if (bindings.some((b) => !b.deleted && b.key === chord && b.id !== except)) return `${label} is taken.`;
  return undefined;
}

/**
 * What pressing a Command's key does: run it at once when it is headless and
 * needs nothing (`invoke`), else open its dialog — a Macro's asked form is its
 * dialog too — else run it (a Command that takes the user somewhere). Nothing
 * for a Command that needs arguments and has no dialog to ask them.
 */
export function howKeyRuns(def: CommandDef): "invoke" | "dialog" | "run" | undefined {
  if (def.invoke && def.args && !def.args.some((a) => a.required)) return "invoke";
  if (def.dialog) return "dialog";
  if (def.run) return "run";
  return undefined;
}

// --- persistence -----------------------------------------------------------

export function useKeyBindings(): KeyBindingRecord[] {
  return useLiveQuery(
    async () => (await db().collection<KeyBindingRecord>(KEY_BINDINGS).where("deleted").equals(0).toArray()).sort((a, b) => a.key.localeCompare(b.key)),
    [],
    [] as KeyBindingRecord[],
  );
}

/** Bind a key (or change a binding, with `id`). Throws the refusal when the key cannot be taken. */
export async function saveKeyBinding(input: { id?: string; key: string; command: string }): Promise<KeyBindingRecord> {
  const live = await db().collection<KeyBindingRecord>(KEY_BINDINGS).where("deleted").equals(0).toArray();
  const refusal = keyRefusal(input.key, live, input.id);
  if (refusal) throw new Error(refusal);
  const rec: KeyBindingRecord = { id: input.id ?? newId(), key: input.key, command: input.command, updatedAt: "", deleted: 0 };
  await put<KeyBindingRecord>(KEY_BINDINGS, rec);
  return rec;
}

export async function removeKeyBinding(id: string): Promise<void> {
  await remove(KEY_BINDINGS, id);
}

/** Undo of `removeKeyBinding`: the row comes back as it was. */
export async function restoreKeyBinding(rec: KeyBindingRecord): Promise<void> {
  await put<KeyBindingRecord>(KEY_BINDINGS, { ...rec, deleted: 0 });
}
