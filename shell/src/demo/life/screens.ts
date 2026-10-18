import {
  currentWorkspace,
  currentWorkspaceId,
  newId,
  put,
  saveWorkspace,
  seedBar,
  BAR_LEFT_SLOT,
  type ScreenLayoutItem,
  type UserScreen,
} from "@lifeline/core";
import { rememberPlace } from "../../nav/resume";
import type { LifeClock } from "../persona";
import { idOf } from "./act";

/**
 * Where the Demo opens: a Screen of Cards over the whole seeded life (CONTEXT.md
 * "Screen", "Card"), so the first thing a visitor sees is the Card system, with
 * today's agenda on an hour scale at the top. Named "Home" by the made-up
 * person; to Core it is an ordinary Screen, in a Phone bar slot and remembered
 * as the last place (ADR 0057: `/` resumes).
 */
export async function seedHome(_c: LifeClock): Promise<void> {
  const ws = (await currentWorkspace())!;
  const kinsale = await idOf("event", "Weekend in Kinsale");
  const card = (cardId: string, x: number, y: number, w: number, h: number, more: Partial<ScreenLayoutItem> = {}) => ({
    instanceId: `home-${cardId}`,
    cardId,
    x,
    y,
    w,
    h,
    ...more,
  });
  // A 12-column grid; the phone reads it top to bottom, left to right.
  const layout: ScreenLayoutItem[] = [
    card("hub.agenda", 0, 0, 4, 12),
    card("tasks.today", 4, 0, 4, 6),
    card("mood.today", 8, 0, 4, 3),
    card("stats.habits", 8, 3, 4, 9),
    card("chores.due-today", 4, 6, 4, 6),
    card("pocket.allowances", 0, 12, 4, 5, { title: "What's left" }),
    card("library.in-progress", 4, 12, 4, 5, { title: "Reading" }),
    card("calendar.countdown", 8, 12, 4, 5, { settings: { event: kinsale } }),
    card("thoughts.recent", 0, 17, 6, 5, { settings: { count: 4, kind: "" } }),
    card("commonplace.quote-day", 6, 17, 6, 5),
  ];
  const id = newId();
  await put<UserScreen>("screens", { id, name: "Home", layout, sort: 0, workspace: ws.id });

  // The slot left of capture on the Phone bar; the right two stay as seeded.
  const bar = [...(ws.bar ?? seedBar(ws.modules))];
  while (bar.length <= BAR_LEFT_SLOT) bar.push(null);
  bar[BAR_LEFT_SLOT] = { kind: "screen", id };
  await saveWorkspace({ ...ws, bar });

  rememberPlace(currentWorkspaceId(), `/screen/${id}`);
}
