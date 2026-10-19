import { useCallback, useEffect, useRef, useState } from "react";

/**
 * A value edited in place and written a moment after the typing stops (as the
 * Vault's editor does), so a keystroke never waits on the store — and a date
 * typed digit by digit is written once, not as every partial year on the way.
 * Shows the edit until it is written, then the saved value again; whatever is
 * still waiting goes out on unmount. Key the owner by its Document, so an edit
 * never carries over to another one.
 */
export function useSoonWritten<T>(saved: T, write: (value: T) => unknown, delay = 500): [T, (value: T) => void] {
  const [draft, setDraft] = useState<{ value: T } | null>(null);
  const pending = useRef<{ value: T } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeRef = useRef(write);
  useEffect(() => {
    writeRef.current = write;
  });
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    void Promise.resolve(writeRef.current(p.value)).finally(() => setDraft((d) => (d === p ? null : d)));
  }, []);
  const set = useCallback(
    (value: T) => {
      const p = { value };
      pending.current = p;
      setDraft(p);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );
  useEffect(() => () => flush(), [flush]);
  return [draft ? draft.value : saved, set];
}
