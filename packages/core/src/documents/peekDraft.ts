import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A typed value in an App's editable Peek part (ADR 0085), held while it is
 * typed and handed to the App's own operation when the control is left — on
 * blur, on Enter, or when the Peek closes or moves to another Document — so a
 * half-typed unit is never trimmed or re-normalised under the cursor. While
 * nothing is being typed it follows the stored value, so an edit made
 * elsewhere shows.
 *
 * `commit` receives the draft only when it differs from `value`, and is read
 * at the time of commit, so it sees the Document as it is then.
 */
export function usePeekDraft(value: string, commit: (next: string) => unknown): {
  value: string;
  onChange: (next: string) => void;
  /** Hand the draft over now (blur, Enter). */
  flush: () => void;
} {
  const [draft, setDraft] = useState(value);
  const dirty = useRef(false);
  const latest = useRef({ draft: value, value, commit });
  latest.current = { draft, value, commit };

  useEffect(() => {
    if (!dirty.current) setDraft(value);
  }, [value]);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    const { draft, value, commit } = latest.current;
    if (draft !== value) void commit(draft);
  }, []);

  // Closing the Peek unmounts the part before any blur reaches it.
  useEffect(() => flush, [flush]);

  const onChange = useCallback((next: string) => {
    dirty.current = true;
    latest.current.draft = next;
    setDraft(next);
  }, []);

  return { value: draft, onChange, flush };
}
