import { useMemo } from "react";

/**
 * The previous value while the new one is structurally the same (JSON-equal).
 * The read-side Contract hooks rebuild their rows on every render — each
 * provider maps its own live query afresh — so without this every `useMemo`
 * downstream of them misses. Rows are plain data; a few hundred at most.
 */
export function useStructuralMemo<T>(value: T): T {
  const key = JSON.stringify(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => value, [key]);
}
