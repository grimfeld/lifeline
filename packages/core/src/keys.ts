/** Whether the app runs on an Apple platform, where ⌘ is the shortcut key and Ctrl belongs to the text (Ctrl+E, Ctrl+K…). */
export function isApplePlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform ?? navigator.platform ?? "";
  return /mac|iphone|ipad|ipod/i.test(platform || navigator.userAgent);
}

type KeyLike = Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey" | "defaultPrevented">;

/**
 * A global ⌘/Ctrl+`key` shortcut: ⌘ on a Mac, Ctrl elsewhere — never the
 * other one, so a Mac's Ctrl+E / Ctrl+K stay the text editor's line keys —
 * and not when something nearer the focus (CodeMirror's keymap) already took
 * the key.
 */
export function isModShortcut(e: KeyLike, key: string, apple: boolean = isApplePlatform()): boolean {
  if (e.defaultPrevented || e.altKey || e.shiftKey) return false;
  const mod = apple ? e.metaKey && !e.ctrlKey : e.ctrlKey && !e.metaKey;
  return mod && e.key.toLowerCase() === key.toLowerCase();
}
