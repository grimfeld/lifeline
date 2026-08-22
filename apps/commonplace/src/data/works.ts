import { useMemo } from "react";
import { documentsOf, useLiveQuery } from "@lifeline/core";
import { WORK_TYPE_IDS, type QuotedWork } from "../domain/works";

/** Every quotable work across the family Apps' types (read-only; one query per type, flattened). */
export function useQuotedWorks(): QuotedWork[] {
  const rows = useLiveQuery(
    async () => (await Promise.all(WORK_TYPE_IDS.map((t) => documentsOf<QuotedWork>(t)))).flat(),
    [],
    [] as QuotedWork[],
  );
  return useMemo(() => rows.map((m) => ({ ...m, creator: m.creator ?? "", coverUrl: m.coverUrl ?? "" })), [rows]);
}
