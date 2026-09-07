import { newId, put, useWorkspaceScreens, type UserScreen } from "@lifeline/core";

/**
 * Phone home (ADR 0021, amended by ADR 0047): the Screen this Workspace opens
 * as Home. `usePhoneHomeScreen` and `setPhoneHome` live in Core now — the flag
 * is unique per Workspace rather than globally, so both need the Workspace
 * scope and neither is shell furniture any more.
 */
export { usePhoneHomeScreen as usePhoneHome, setPhoneHome } from "@lifeline/core";

/** The starter phone home: due today, tasks, recent clippings, quick clip. */
export async function createStarterPhoneHome(sort: number, workspace: string): Promise<string> {
  const id = newId();
  await put<UserScreen>("screens", {
    id,
    name: "Phone",
    sort,
    phoneHome: true,
    workspace,
    layout: [
      { instanceId: newId(), cardId: "chores.due-today", x: 0, y: 0, w: 6, h: 5 },
      { instanceId: newId(), cardId: "tasks.today", x: 6, y: 0, w: 6, h: 5 },
      { instanceId: newId(), cardId: "clipper.recent", x: 0, y: 5, w: 6, h: 6 },
      { instanceId: newId(), cardId: "clipper.quick", x: 6, y: 5, w: 6, h: 6 },
    ],
  });
  return id;
}

export { useWorkspaceScreens };
