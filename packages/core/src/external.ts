/**
 * Open a URL outside Lifeline: the system browser under Tauri (opener
 * plugin), a new tab in a plain browser. Only http(s) URLs are ever opened.
 */
export function isExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function openExternal(url: string): Promise<void> {
  if (!isExternalUrl(url)) throw new Error("Only http(s) URLs can be opened");
  if (isTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
