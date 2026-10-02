import { useMemo } from "react";
import { documentsOf, useLiveQuery, type Document } from "@lifeline/core";
import { WORK_TYPE_IDS, type QuotedWork } from "../domain/works";

/** The Library's Authors (ADR 0052): a book's byline is its Authors' names, read here like any other Document. */
const AUTHOR = "author";

/** Every quotable work, read once — what a headless quote names its work against. */
export async function allQuotedWorks(): Promise<QuotedWork[]> {
  return (await Promise.all(WORK_TYPE_IDS.map((t) => documentsOf<QuotedWork>(t)))).flat();
}

/** Every quotable work across the family Apps' types (read-only; one query per type, flattened), with its byline resolved. */
export function useQuotedWorks(): QuotedWork[] {
  const rows = useLiveQuery(
    async () => {
      const [works, authors] = await Promise.all([Promise.all(WORK_TYPE_IDS.map((t) => documentsOf<QuotedWork>(t))), documentsOf<Document>(AUTHOR)]);
      return { works: works.flat(), authors };
    },
    [],
    { works: [] as QuotedWork[], authors: [] as Document[] },
  );
  return useMemo(() => {
    const names = new Map(rows.authors.map((a) => [a.id, a.title]));
    return rows.works.map((m) => {
      const ids = Array.isArray(m.authors) ? (m.authors as string[]) : [];
      const byline = ids.map((id) => names.get(id) ?? "").filter(Boolean).join(", ");
      return { ...m, creator: byline || (m.creator ?? ""), coverUrl: m.coverUrl ?? "" };
    });
  }, [rows]);
}
