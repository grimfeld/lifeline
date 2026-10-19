import { db, ensureDefaultWorkspace, eraseDevice, todayStr, type DateStr } from "@lifeline/core";
import { lifeClock, type LifeClock } from "./persona";
import { setDemoFilling } from "./filling";
import { seedAgenda } from "./life/agenda";
import { seedTracking } from "./life/tracking";
import { seedMoney } from "./life/money";
import { seedWork } from "./life/work";
import { seedMedia } from "./life/media";
import { seedDayTemplate, seedWriting } from "./life/writing";
import { seedWindows } from "./life/windows";
import { seedHome, seedOverviews } from "./life/screens";

/**
 * The Demo life (CONTEXT.md "Demo", ADR 0077): a made-up person's life written
 * into this browser's store on first open, dated around the visit day. Kept
 * apart from the e2e layout seed, which is deliberately absurd.
 */

/** Set in `_meta`, so erasing the store (Reset, clearing site data) clears it too. */
const SEEDED = "demo:seeded";
const SEEDING = "seeding";

/** What the first screen needs: today's agenda, and Home showing it. */
async function seedFirstScreen(clock: LifeClock): Promise<void> {
  await ensureDefaultWorkspace();
  await seedAgenda(clock);
  await seedHome(clock);
  // Before anything can open a Day, so a Day made then starts from it.
  await seedDayTemplate();
}

/** The rest of the life, written while the visitor already looks at Home. */
async function seedRest(clock: LifeClock): Promise<void> {
  // Side by side: the slices write disjoint types and name nothing of each
  // other's. Each write makes the screen already up read the store again; the
  // more writes land between two of those reads, the fewer reads in all.
  await Promise.all([seedWork(clock), seedMedia(clock), seedTracking(clock), seedWriting(clock), seedMoney(clock), seedWindows(clock)]);
  // Last: the Overviews name Documents the slices made.
  await seedOverviews(clock);
}

/** Write the whole Demo life, dated around `visitDay`. */
export async function seedDemo(visitDay: DateStr): Promise<void> {
  const clock = lifeClock(visitDay);
  await seedFirstScreen(clock);
  await seedRest(clock);
}

/**
 * On start in the Demo: seed once per device, calling `show` as soon as the
 * first screen can be shown. A reload with the marker only shows.
 *
 * The whole life takes a few seconds, so the first open writes today's agenda
 * and Home, shows them, and writes the rest behind them (#104) while the shell
 * says so. The marker stays "seeding" until the very end: a reload at any
 * point before erases the half-written life and starts over, rather than
 * seeding on top of it.
 */
export async function seedDemoIfNeeded(show: () => void): Promise<void> {
  const meta = db()._meta;
  const marker = (await meta.get(SEEDED))?.value;
  if (marker && marker !== SEEDING) return show();
  if (marker === SEEDING) {
    await eraseDevice();
    return new Promise(() => {}); // the reload takes over
  }
  await meta.put({ key: SEEDED, value: SEEDING });
  const visitDay = todayStr();
  const clock = lifeClock(visitDay);
  await seedFirstScreen(clock);
  setDemoFilling(true);
  show();
  try {
    await seedRest(clock);
    await meta.put({ key: SEEDED, value: visitDay });
  } finally {
    setDemoFilling(false);
  }
}
