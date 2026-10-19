import {
  currentWorkspace,
  currentWorkspaceId,
  defaultOverview,
  saveOverview,
  type OverviewSlot,
  newId,
  parts,
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
import { FINISHED } from "./media";

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
  // A 12-column grid; the phone stacks it top to bottom, left to right
  // (stackOrder), so the day's Tasks and mood come before the tall agenda and
  // the phone's first screen shows more than one Card.
  const layout: ScreenLayoutItem[] = [
    card("tasks.today", 0, 0, 4, 6),
    card("mood.today", 4, 0, 4, 3),
    card("hub.agenda", 8, 0, 4, 12),
    card("stats.habits", 4, 3, 4, 9),
    card("chores.due-today", 0, 6, 4, 6),
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

/**
 * The key Overviews (ADR 0066), arranged the way someone who lives in them
 * would: each Module's default Cards, then a few more that show history —
 * a price over time, a chore heatmap, the year's finished books and films, a
 * mood grid and a measured Stat. Saved per Workspace, as a user's edit is.
 */
export async function seedOverviews(c: LifeClock): Promise<void> {
  const milk = await idOf("price_product", "Semi-skimmed milk");
  const heart = await idOf("stat", "Resting heart rate");
  const arranged: Record<string, OverviewSlot[]> = {
    money: [
      { cardId: "pocket.allowances", title: "What's left" },
      { cardId: "ledger.budget-month" },
      { cardId: "ledger.balances" },
      { cardId: "ledger.dues" },
      { cardId: "prices.product", settings: { product: milk } },
      { cardId: "ledger.quickadd" },
    ],
    house: [
      { cardId: "chores.due-today" },
      { cardId: "shopping.list" },
      { cardId: "pantry.running-low" },
      { cardId: "pantry.expiring" },
      { cardId: "chores.heatmap", settings: { weeks: 6 }, wide: true },
    ],
    culture: [
      { cardId: "library.in-progress", title: "Reading" },
      { cardId: "cinema.in-progress", title: "Watching" },
      { cardId: "discotheque.in-progress", title: "Listening" },
      { cardId: "arcade.in-progress", title: "Playing" },
      // The year of the last finish, not the calendar's: in early January,
      // "Read in" last year still shows the life rather than nothing.
      { cardId: "library.finished", settings: { year: parts(c.day(FINISHED.book)).y } },
      { cardId: "cinema.finished", settings: { year: parts(c.day(FINISHED.film)).y } },
      { cardId: "museum.on-display", wide: true },
    ],
    progress: [
      { cardId: "mood.today" },
      { cardId: "stats.habits" },
      { cardId: "workout.start" },
      { cardId: "swearjar.jar" },
      { cardId: "mood.grid" },
      { cardId: "stats.single", settings: { stat: heart, period: "month" } },
      { cardId: "workout.recent" },
    ],
  };
  for (const [moduleId, slots] of Object.entries(arranged)) {
    const layout = defaultOverview(slots);
    // A work in progress shows its cover, two lines of "started … ago", the
    // next Part and its kind: a row taller than the Cards' default, or the
    // kind is cut off at the bottom.
    await saveOverview(moduleId, moduleId === "culture" ? taller(layout, (l) => l.cardId.endsWith(".in-progress"), 1) : layout);
  }
}

/** Grow every grid row holding a Card that `wants` by `rows`, moving the rows below down. */
function taller(layout: ScreenLayoutItem[], wants: (l: ScreenLayoutItem) => boolean, rows: number): ScreenLayoutItem[] {
  const grown = [...new Set(layout.filter(wants).map((l) => l.y))];
  return layout.map((l) => ({
    ...l,
    y: l.y + rows * grown.filter((y) => y < l.y).length,
    h: grown.includes(l.y) ? l.h + rows : l.h,
  }));
}
