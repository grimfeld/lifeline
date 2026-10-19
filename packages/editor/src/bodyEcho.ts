/**
 * Telling our own writes coming back from news. The stored body lags behind
 * the keystrokes for the length of a write's round trip, so a Document arriving
 * with a body we ourselves wrote is our own write catching up, not news, and
 * must not be pushed back into the editor — it would undo whatever was typed
 * meanwhile (erasing characters fast used to fight the editor, the last one
 * reappearing over and over as each save came back). Anything else — another
 * device's edit, a Restore, text mode — is news and wins.
 */
export interface Echoes {
  /** The body the editor holds; ahead of the stored one until a write comes back. */
  editor: string | null;
  /** Bodies of ours that may still be read back. */
  ours: string[];
}

export function createEchoes(): Echoes {
  return { editor: null, ours: [] };
}

/** The editor holds `body` and has handed it to be written. */
export function noteStaged(e: Echoes, body: string): void {
  e.editor = body;
}

/**
 * `after` went to the store, over `before`. Both are ours until it comes back:
 * a render can land before the write does (another live query emitting first)
 * and show `before`, which is the store not having caught up — taken for news,
 * it dropped what was last typed and then put it back after the caret.
 */
export function noteWritten(e: Echoes, before: string, after: string): void {
  e.ours = [...e.ours, before, after].slice(-10);
}

/** The text the editor works on, given the stored body and whether a body is still staged. */
export function bodyToEdit(e: Echoes, stored: string, staged: boolean): string {
  if (e.editor === null || stored === e.editor) {
    e.ours = [];
    return stored;
  }
  if (staged || e.ours.includes(stored)) return e.editor;
  e.editor = null;
  e.ours = [];
  return stored;
}
