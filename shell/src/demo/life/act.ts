import { allCommands, documentsOf, invokeCommand, patchDocument, schedulableProviders, type DateStr } from "@lifeline/core";

/**
 * How the Demo life writes (#104): through what an App itself writes with, so
 * each App's rules and guarded fields hold —
 *
 * - its headless Commands first (`run`, `complete`), as an agent would;
 * - where no Command exists (Accounts, Allowances, Shelf moves, Playlists, a
 *   Pantry Storages…), the App's own data and domain functions, imported from
 *   its package's `src/` (Apps export only their manifest, so these are deep
 *   imports, and an App's refactor can break the Demo life — the e2e `demo`
 *   project catches it);
 * - Home's Screen with Core's `put("screens", …)`, as the Screen editor saves it;
 * - for history only, a Core write of an unguarded key (`madeOn`, and
 *   `patchDocument` of a taken-at time or a body), never a guarded one.
 */

/** Run an App's headless Command by id, as an agent would; returns the Document it made, if it says. */
export async function run(commandId: string, args: Record<string, unknown>): Promise<string | undefined> {
  const cmd = allCommands().find((c) => c.id === commandId);
  if (!cmd) throw new Error(`Demo life: no Command "${commandId}"`);
  return (await invokeCommand(cmd, args)).id;
}

/** Tick an item off through its App's Schedulable provider, on a given day. */
export async function complete(appId: string, itemId: string, on: DateStr): Promise<void> {
  const provider = schedulableProviders().find((p) => p.appId === appId);
  if (!provider) throw new Error(`Demo life: no Schedulable "${appId}"`);
  await provider.complete(itemId, on);
}

/** The id of the Document of `type` titled `title` — for Commands that return none. */
export async function idOf(type: string, title: string): Promise<string> {
  const doc = (await documentsOf(type)).find((d) => d.title === title);
  if (!doc) throw new Error(`Demo life: no ${type} "${title}"`);
  return doc.id;
}

/**
 * Pretend a Document was made on an earlier day. Commands stamp "today";
 * history (a recurring Task's past Occurrences, a Chore's past cycles) counts
 * from `createdAt`, which no App guards. A Document's `createdAt` is a
 * DateStr (Core's `putDocument` stamps `todayStr()`, and Tasks and Chores
 * compare it with days), not an ISO timestamp.
 */
export function madeOn(id: string, day: DateStr): Promise<void> {
  return patchDocument(id, { createdAt: day });
}
