/** What a bulk delete did: the ids that went, and the ones an `onDelete` guard refused, with its message. */
export interface RemoveEachResult {
  removed: string[];
  refused: { id: string; message: string }[];
}

/** Tries each id on its own, so one refusal (a thrown Error) neither stops the rest nor loses the reason. */
export async function removeEach(ids: string[], remove: (id: string) => Promise<unknown>): Promise<RemoveEachResult> {
  const result: RemoveEachResult = { removed: [], refused: [] };
  for (const id of ids) {
    try {
      await remove(id);
      result.removed.push(id);
    } catch (e) {
      result.refused.push({ id, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}

/** The refusals as one line: the message alone when they agree, else each distinct one. */
export function refusalSummary(refused: { message: string }[]): string {
  return Array.from(new Set(refused.map((r) => r.message))).join("; ");
}
