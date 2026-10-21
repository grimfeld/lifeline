import { describe, expect, it } from "vitest";
import { chordLabel, chordOf, keyRefusal, howKeyRuns, type KeyBindingRecord } from "./keyBindings";
import type { CommandDef } from "./manifest";

const press = (key: string, mods: Partial<Record<"metaKey" | "ctrlKey" | "altKey" | "shiftKey", boolean>> = {}, code = "") => ({
  key,
  code,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  defaultPrevented: false,
  ...mods,
});

describe("chordOf", () => {
  it("reads ⌘ on a Mac and Ctrl elsewhere as the same Mod key, so a binding travels between desks", () => {
    expect(chordOf(press("j", { metaKey: true }), true)).toBe("Mod+J");
    expect(chordOf(press("j", { ctrlKey: true }), false)).toBe("Mod+J");
  });

  it("keeps Alt and Shift, in a fixed order", () => {
    expect(chordOf(press("J", { metaKey: true, shiftKey: true, altKey: true }, "KeyJ"), true)).toBe("Mod+Alt+Shift+J");
  });

  it("reads the letter from the key's position when Alt turned it into another character", () => {
    expect(chordOf(press("∆", { metaKey: true, altKey: true }, "KeyJ"), true)).toBe("Mod+Alt+J");
  });

  it("is nothing without Mod, on a lone modifier, or with a Mac's Ctrl", () => {
    expect(chordOf(press("j"), true)).toBeUndefined();
    expect(chordOf(press("j", { altKey: true }), true)).toBeUndefined();
    expect(chordOf(press("Meta", { metaKey: true }), true)).toBeUndefined();
    expect(chordOf(press("j", { ctrlKey: true }), true)).toBeUndefined();
    expect(chordOf(press("j", { ctrlKey: true, metaKey: true }), false)).toBeUndefined();
  });

  it("is nothing when something nearer the focus already took the key", () => {
    expect(chordOf({ ...press("j", { metaKey: true }), defaultPrevented: true }, true)).toBeUndefined();
  });
});

describe("chordLabel", () => {
  it("writes a chord the way the platform does", () => {
    expect(chordLabel("Mod+Alt+Shift+J", true)).toBe("⌥⇧⌘J");
    expect(chordLabel("Mod+Alt+Shift+J", false)).toBe("Ctrl+Alt+Shift+J");
    expect(chordLabel("Mod+ArrowUp", true)).toBe("⌘↑");
  });
});

const binding = (id: string, key: string, command: string): KeyBindingRecord => ({ id, key, command, updatedAt: "", deleted: 0 });

describe("keyRefusal", () => {
  it("refuses the keys Lifeline already uses", () => {
    expect(keyRefusal("Mod+K", [])).toMatch(/palette/);
    expect(keyRefusal("Mod+E", [])).toMatch(/edit/i);
    expect(keyRefusal("Mod+.", [])).toMatch(/selection/i);
    expect(keyRefusal("Mod+3", [])).toMatch(/Module/);
  });

  it("refuses the browser's essentials", () => {
    for (const k of ["Mod+C", "Mod+V", "Mod+Z", "Mod+Shift+Z", "Mod+W", "Mod+T", "Mod+R", "Mod+L", "Mod+F"]) {
      expect(keyRefusal(k, [])).toMatch(/browser/);
    }
  });

  it("shows a key already bound as taken, unless it is the binding being changed", () => {
    const taken = [binding("b1", "Mod+B", "tasks/tasks.add")];
    expect(keyRefusal("Mod+B", taken)).toMatch(/taken/);
    expect(keyRefusal("Mod+B", taken, "b1")).toBeUndefined();
    expect(keyRefusal("Mod+Alt+B", taken)).toBeUndefined();
  });
});

describe("howKeyRuns", () => {
  const headless: CommandDef = { id: "x", title: "X", args: [{ key: "n", label: "N", kind: "number" }], invoke: async () => ({ message: "ok" }) };
  const Dialog = () => null;

  it("runs a complete headless Command directly", () => {
    expect(howKeyRuns(headless)).toBe("invoke");
    expect(howKeyRuns({ ...headless, dialog: Dialog })).toBe("invoke");
  });

  it("opens the dialog when the Command needs arguments", () => {
    const needs = { ...headless, args: [{ key: "t", label: "T", kind: "text" as const, required: true }], dialog: Dialog };
    expect(howKeyRuns(needs)).toBe("dialog");
    expect(howKeyRuns({ id: "d", title: "D", dialog: Dialog })).toBe("dialog");
  });

  it("runs a Command that takes the user somewhere", () => {
    expect(howKeyRuns({ id: "g", title: "Go", run: () => {} })).toBe("run");
  });

  it("is nothing for a Command that needs arguments and has no dialog to ask them", () => {
    expect(howKeyRuns({ ...headless, args: [{ key: "t", label: "T", kind: "text", required: true }] })).toBeUndefined();
  });
});
