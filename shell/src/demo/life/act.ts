import { allCommands, documentsOf, invokeCommand, patchDocument, schedulableProviders, type DateStr } from "@lifeline/core";

/**
 * How the Demo life writes: only through App Commands and Core APIs (#104),
 * never raw table writes, so each App's rules and guarded fields hold.
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
 * from `createdAt`, which no App guards.
 */
export function madeOn(id: string, day: DateStr): Promise<void> {
  return patchDocument(id, { createdAt: day });
}
