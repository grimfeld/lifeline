import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A value edited in place and handed to its owner's operation (`commit`) when
 * the edit is done — the one mechanism behind every field edited without a form
 * to save (a Peek, ADR 0085; CODING_STANDARDS.md § Forms and feedback).
 *
 * While nothing is being edited it shows the stored `value`, so a change made
 * elsewhere shows. A change is held (`draft`) until it is committed: by the
 * caller (`commit()`, on leaving the control or Enter), or — with `delay` — a
 * moment after the last change, as the Vault's editor writes. Whatever is still
 * held goes out when the owner unmounts (the Peek closed or moved on). When
 * `commit` refuses (throws or rejects), its message is `error` and the draft
 * stays, to be fixed. `revert()` drops the draft (Escape).
 *
 * `commit` is called only when the draft differs from `value`, and is read at
 * the time of the commit, so it sees the Document as it is then.
 */
export function useCommitDraft<T>(
  value: T,
  commit: (next: T) => unknown,
  { delay, equals = Object.is }: { delay?: number; equals?: (a: T, b: T) => boolean } = {},
): { draft: T; error: string; change: (next: T) => void; commit: () => Promise<void>; revert: () => void } {
  const [held, setHeld] = useState<{ value: T } | null>(null);
  const [error, setError] = useState("");
  const latest = useRef({ held, value, commit, equals });
  latest.current = { ...latest.current, value, commit, equals };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hold = (next: { value: T } | null) => {
    latest.current.held = next;
    setHeld(next);
  };

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { held: h, value: stored, commit: write, equals: same } = latest.current;
    if (!h) return;
    // Let go of the draft once written, unless it was typed over meanwhile.
    const release = () => {
      if (latest.current.held === h) hold(null);
    };
    if (same(h.value, stored)) {
      setError("");
      return release();
    }
    try {
      await write(h.value);
      setError("");
      release();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const change = useCallback(
    (next: T) => {
      hold({ value: next });
      if (delay === undefined) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), delay);
    },
    [delay, flush],
  );

  const revert = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    hold(null);
    setError("");
  }, []);

  // Closed mid-edit: what was typed is still written.
  useEffect(() => () => void flush(), [flush]);

  return { draft: held ? held.value : value, error, change, commit: flush, revert };
}
