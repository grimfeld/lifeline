import { parts, weekdayOf } from "@lifeline/core";
import { PEOPLE, PLACES, type LifeClock } from "../persona";
import { complete, idOf, madeOn, run } from "./act";

const first = (name: string) => name.split(" ")[0];
const { aoife, helen, marcus, priya, sam } = PEOPLE;

/**
 * The Agenda slice of the Demo life: Tasks, Chores and Events from three weeks
 * back to a week ahead, so today always has work to tick and something on the
 * hours — whatever day the visitor comes.
 */
export async function seedAgenda(c: LifeClock): Promise<void> {
  await seedTasks(c);
  await seedChores(c);
  await seedEvents(c);
}

async function seedTasks(c: LifeClock): Promise<void> {
  const task = (title: string, args: Record<string, unknown> = {}) => run("tasks.add", { title, ...args });

  await task(`Send ${first(aoife.name)} the Kinsale B&B options`, { date: c.today, estimate: 15 });
  await task("Renew the bike insurance", { date: c.today, estimate: 20, tags: ["admin"] });
  await task("Write up Mr Doyle's knee rehab plan", { date: c.day(-1), estimate: 45, tags: ["work"] });
  await task("Book a haircut", { date: c.day(2) });
  await task(`Pick up the frame for ${first(helen.name)}'s birthday`, { date: c.day(1) });
  await task("Order chalk and tape for the gym", { date: c.day(4) });

  // The pool: things with no day yet.
  await task("Find a new climbing harness", { notes: "Ask Marcus which one he swears by." });
  await task("Sort the phone photo backup");

  // Recently done.
  const drill = await task(`Return the drill to ${first(priya.name)}`, { date: c.day(-2) });
  if (drill) await complete("tasks", drill, c.day(-2));
  const gas = await task("Pay the gas bill", { date: c.day(-1), tags: ["admin"] });
  if (gas) await complete("tasks", gas, c.day(-1));

  // A weekly habit of a Task, with its past Sundays ticked.
  const plan = await task("Plan the week ahead", { recurrence: { kind: "weekly", weekdays: [0] }, estimate: 20 });
  if (plan) {
    await madeOn(plan, c.day(-21));
    for (let n = -21; n < 0; n++) {
      const d = c.day(n);
      if (weekdayOf(d) === 0) await complete("tasks", `${plan}|${d}`, d);
    }
  }
}

async function seedChores(c: LifeClock): Promise<void> {
  /** Add a Chore made three weeks ago, done on the given days back. */
  const chore = async (title: string, schedule: object, done: number[], anchor?: number) => {
    await run("chores.add", { title, schedule, ...(anchor !== undefined ? { anchorDate: c.day(anchor) } : {}) });
    const id = await idOf("chore", title);
    await madeOn(id, c.day(-21));
    for (const n of done) await complete("chores", id, c.day(n));
  };

  // Due today: the bins go out on the visit day's weekday.
  await chore("Take out the recycling", { kind: "weekly", weekdays: [weekdayOf(c.today)] }, [-21, -14, -7]);
  await chore("Water the balcony herbs", { kind: "interval", days: 3 }, [-9, -6, -3], -9);
  // Overdue.
  await chore("Clean the bathroom", { kind: "weekly", weekdays: [weekdayOf(c.day(-2))] }, [-16, -9]);
  await chore("Vacuum the flat", { kind: "interval", days: 7 }, [-15, -8], -15);
  // Coming up.
  await chore("Change the bed sheets", { kind: "interval", days: 14 }, [-10], -10);
  await chore("Descale the kettle", { kind: "monthly", dayOfMonth: Math.min(parts(c.day(6)).day, 28) }, []);
}

async function seedEvents(c: LifeClock): Promise<void> {
  const event = (title: string, offset: number, args: Record<string, unknown> = {}) =>
    run("calendar.add-event", { title, date: c.day(offset), ...args });

  // Today.
  await event(`Team huddle with ${first(sam.name)}`, 0, { start: "08:30", end: "09:00", notes: `At ${PLACES.clinic.name}.` });
  await event(`Lunch with ${first(aoife.name)}`, 0, { start: "13:00", end: "14:00", notes: `Coffee after at the ${PLACES.market.name}.` });
  await event(`Climbing with ${first(marcus.name)}`, 0, { start: "19:00", end: "21:00", notes: PLACES.crag.name });

  // Behind.
  await event("Dentist check-up", -5, { start: "10:00", end: "10:30" });
  await event(`Call ${first(helen.name)}`, -3, { start: "18:00", end: "18:45" });
  await event(`Sea swim at ${PLACES.myrtleville.name}`, -2, { start: "08:00", end: "09:30" });
  await event("Running club 5k", -1, { start: "18:30", end: "19:30", notes: PLACES.park.name });

  // Ahead.
  await event(`Coffee with ${first(priya.name)}`, 1, { start: "10:30", end: "11:15" });
  await event(`${first(helen.name)}'s birthday`, 2);
  await event("Weekend in Kinsale", 5, { endDate: c.day(7), notes: `With ${first(aoife.name)}.` });
}
