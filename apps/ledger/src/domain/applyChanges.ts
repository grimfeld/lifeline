import type { RuleChange } from "./suggest";

type Write = (id: string, categoryId: string) => Promise<void>;

async function writeAll(changes: RuleChange[], pick: (c: RuleChange) => string, write: Write, label: string): Promise<RuleChange[]> {
  const done: RuleChange[] = [];
  try {
    for (const c of changes) {
      await write(c.transaction.id, pick(c));
      done.push(c);
    }
  } catch (e) {
    throw new Error(`${label} after ${done.length} of ${changes.length}: ${e instanceof Error ? e.message : String(e)}`);
  }
  return done;
}

/** Write each change's `to` in turn; on failure stop and say how far it got. Returns the changes written, so a caller can offer to put `from` back. */
export const applyRuleChanges = (changes: RuleChange[], write: Write) => writeAll(changes, (c) => c.to, write, "Stopped");

/** Put each change's exact previous Category (`from`, "" = uncategorized) back; on failure stop and say how far it got. */
export const undoRuleChanges = (changes: RuleChange[], write: Write) => writeAll(changes, (c) => c.from, write, "Undo stopped");
