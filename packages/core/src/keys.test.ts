import { describe, expect, it } from "vitest";
import { isModShortcut } from "./keys";

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({ key: k, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, defaultPrevented: false, ...mods });

describe("isModShortcut", () => {
  it("is ⌘ on a Mac and leaves Ctrl to the text editor", () => {
    expect(isModShortcut(key("e", { metaKey: true }), "e", true)).toBe(true);
    expect(isModShortcut(key("e", { ctrlKey: true }), "e", true)).toBe(false);
  });

  it("is Ctrl elsewhere", () => {
    expect(isModShortcut(key("K", { ctrlKey: true }), "k", false)).toBe(true);
    expect(isModShortcut(key("k", { metaKey: true }), "k", false)).toBe(false);
  });

  it("stands back when the key was already handled", () => {
    expect(isModShortcut(key("k", { ctrlKey: true, defaultPrevented: true }), "k", false)).toBe(false);
  });

  it("ignores the shortcut with Alt or Shift held", () => {
    expect(isModShortcut(key("e", { ctrlKey: true, shiftKey: true }), "e", false)).toBe(false);
    expect(isModShortcut(key("e", { ctrlKey: true, altKey: true }), "e", false)).toBe(false);
  });
});
