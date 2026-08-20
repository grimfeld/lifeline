import { db, newId, put, useLiveQuery, type UserScreen } from "@lifeline/core";

/**
 * Phone home (grill 2026-08-20): the one Screen the phone's bottom bar opens
 * as Home. A synced `phoneHome` bool on the Screen record; set-once from the
 * desktop, at most one Screen holds it.
 */
export function usePhoneHome(): UserScreen | undefined {
  return useLiveQuery(
    async () => (await db().collection<UserScreen>("screens").where("deleted").equals(0).toArray()).find((s) => s.phoneHome),
    [],
    undefined,
  );
}

/** Make `id` the phone home; clears the flag on any other Screen. */
export async function setPhoneHome(id: string): Promise<void> {
  const screens = await db().collection<UserScreen>("screens").where("deleted").equals(0).toArray();
  for (const s of screens) {
    if (s.id === id && !s.phoneHome) await put<UserScreen>("screens", { ...s, phoneHome: true });
    else if (s.id !== id && s.phoneHome) await put<UserScreen>("screens", { ...s, phoneHome: false });
  }
}

/** The starter phone home: due today, tasks, recent clippings, quick clip. */
export async function createStarterPhoneHome(sort: number): Promise<string> {
  const id = newId();
  await put<UserScreen>("screens", {
    id,
    name: "Phone",
    sort,
    phoneHome: true,
    layout: [
      { instanceId: newId(), cardId: "chores.due-today", x: 0, y: 0, w: 6, h: 5 },
      { instanceId: newId(), cardId: "tasks.today", x: 6, y: 0, w: 6, h: 5 },
      { instanceId: newId(), cardId: "clipper.recent", x: 0, y: 5, w: 6, h: 6 },
      { instanceId: newId(), cardId: "clipper.quick", x: 6, y: 5, w: 6, h: 6 },
    ],
  });
  return id;
}
