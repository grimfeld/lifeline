import { db, ensureDefaultWorkspace, todayStr, type DateStr } from "@lifeline/core";
import { lifeClock } from "./persona";
import { seedAgenda } from "./life/agenda";
import { seedTracking } from "./life/tracking";

/**
 * The Demo life (CONTEXT.md "Demo", ADR 0077): a made-up person's life written
 * into this browser's store on first open, dated around the visit day. Kept
 * apart from the e2e layout seed, which is deliberately absurd.
 */

/** Set in `_meta`, so erasing the store (Reset, clearing site data) clears it too. */
const SEEDED = "demo:seeded";
const SEEDING = "seeding";

/** Write the whole Demo life, dated around `visitDay`. Through Commands and Core APIs only. */
export async function seedDemo(visitDay: DateStr): Promise<void> {
  await ensureDefaultWorkspace();
  const clock = lifeClock(visitDay);
  await seedAgenda(clock);
  await seedTracking(clock);
}

/**
 * On start in the Demo: seed once per device. A reload with the marker does
 * nothing; a reload in the middle of seeding (marker still "seeding") erases
 * the half-written life and starts over, rather than seeding on top of it.
 */
export async function seedDemoIfNeeded(): Promise<void> {
  const meta = db()._meta;
  const marker = (await meta.get(SEEDED))?.value;
  if (marker && marker !== SEEDING) return;
  if (marker === SEEDING) {
    await db().delete();
    location.reload();
    return new Promise(() => {});
  }
  await meta.put({ key: SEEDED, value: SEEDING });
  const visitDay = todayStr();
  await seedDemo(visitDay);
  await meta.put({ key: SEEDED, value: visitDay });
}
