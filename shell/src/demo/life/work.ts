import { parts, weekdayOf } from "@lifeline/core";
import { placeTask } from "@lifeline/app-tasks/data";
import { addMilestone, addProject, lanesOf, milestonesOf, setReached, setStage } from "@lifeline/app-projects/src/data/repo";
import { addEventTemplate } from "@lifeline/app-calendar/src/data/templates";
import { addTimeBlocker } from "@lifeline/app-calendar/src/data/blockers";
import { PEOPLE, PLACES, type LifeClock } from "../persona";
import { complete, idOf, madeOn, run } from "./act";

const first = (name: string) => name.split(" ")[0];
const { aoife, luis, marcus, priya, sam } = PEOPLE;

/** Offsets from three weeks back to a week ahead. */
const SPAN = Array.from({ length: 29 }, (_, i) => i - 21);

/**
 * Time and work in the Demo life, on top of the Agenda slice (`./agenda`):
 * Projects with a deadline and a board, more Tasks and Chores across the three
 * weeks behind, the week's routine as Event templates and the Events they made,
 * and the clinic hours as a blocker.
 */
export async function seedWork(c: LifeClock): Promise<void> {
  await seedProjects(c);
  await seedMoreTasks(c);
  await seedMoreChores(c);
  await seedRoutine(c);
  await seedMoreEvents(c);
}

const task = (title: string, args: Record<string, unknown> = {}) => run("tasks.add", { title, ...args });

async function done(title: string, day: number, c: LifeClock, args: Record<string, unknown> = {}): Promise<void> {
  const id = await task(title, { date: c.day(day), ...args });
  if (id) await complete("tasks", id, c.day(day));
}

async function seedProjects(c: LifeClock): Promise<void> {
  // The live one: a talk she gives at the running club, a few days out.
  const talk = await addProject({
    title: "Injury-prevention talk for the running club",
    outcome: "Forty minutes on warm-ups, load and rest that the club actually uses",
    deadline: c.day(4),
    emoji: "🏃",
    color: "blue",
    tags: ["work"],
  });
  await madeOn(talk, c.day(-20));
  await setStage(talk, "active", c.day(-18));

  await addMilestone(talk, `Outline agreed with ${first(sam.name)}`, c.day(-8));
  await addMilestone(talk, "Slides ready", c.day(2));
  const outline = (await milestonesOf(talk))[0];
  if (outline) await setReached(outline, c.day(-9));

  const inTalk = { project: talk };
  await done("Book the club room", -16, c, inTalk);
  await done("Draft the talk outline", -10, c, { ...inTalk, estimate: 60 });
  await done("Film the warm-up drills", -4, c, { ...inTalk, notes: `${first(marcus.name)} held the phone.` });
  const slides = await task("Make the workshop slides", { ...inTalk, date: c.today, estimate: 90 });
  await task(`Rehearse the talk with ${first(sam.name)}`, { ...inTalk, date: c.day(2), estimate: 45 });
  await task("Print the handouts", { ...inTalk, date: c.day(3), estimate: 20 });
  await task("Ask the club for a projector", { ...inTalk });

  const doing = (await lanesOf(talk)).find((l) => l.title === "Doing");
  if (slides && doing) await placeTask(slides, doing.id, 1000);

  // Finished last month.
  const booking = await addProject({
    title: "Move the clinic to online booking",
    outcome: "Patients book and reschedule without ringing the front desk",
    emoji: "🗓️",
    color: "green",
    tags: ["work"],
  });
  await madeOn(booking, c.day(-21));
  await setStage(booking, "active", c.day(-21));
  await done("Write the booking FAQ for patients", -14, c, { project: booking });
  await done("Train the front desk on the new system", -11, c, { project: booking });
  await setStage(booking, "done", c.day(-10));

  // Planned: the summer.
  const lisbon = await addProject({
    title: "Six weeks in Lisbon",
    outcome: "A summer speaking Portuguese, not English",
    start: c.day(10),
    emoji: "☀️",
    color: "orange",
    tags: ["travel"],
  });
  await madeOn(lisbon, c.day(-6));
  await task(`Ask ${first(sam.name)} about six weeks' leave`, { project: lisbon });
  await task("Look at flats in Alfama", { project: lisbon, notes: `${first(luis.name)} says avoid anything on a tram line.` });
}

async function seedMoreTasks(c: LifeClock): Promise<void> {
  // Ticked off over the past weeks.
  await done("Log this year's CPD hours", -19, c, { tags: ["work"] });
  await done("Get new passport photos", -15, c, { tags: ["admin"] });
  await done(`Send ${first(aoife.name)} the playlist for the drive`, -12, c);
  await done("Book the car in for its NCT", -18, c, { tags: ["admin"] });
  await done("Restring the balcony planters", -6, c);

  // Coming up, and one left behind.
  await task("Order a new foam roller for the clinic", { date: c.day(-3), tags: ["work"] });
  await task(`Bake a thank-you cake for ${first(priya.name)}`, { date: c.day(1) });
  await task("Revise Portuguese verbs: ser and estar", { date: c.day(1), estimate: 30 });

  // The rent, monthly, paid each time it came round.
  const rentDay = Math.min(parts(c.day(-12)).day, 28);
  const rent = await task("Pay the rent", { recurrence: { kind: "monthly", days: [rentDay] }, tags: ["admin"] });
  if (rent) {
    await madeOn(rent, c.day(-21));
    for (const n of SPAN.filter((n) => n < 0)) {
      const d = c.day(n);
      if (parts(d).day === rentDay) await complete("tasks", `${rent}|${d}`, d);
    }
  }
}

async function seedMoreChores(c: LifeClock): Promise<void> {
  const chore = async (title: string, schedule: object, doneOn: number[], anchor?: number) => {
    await run("chores.add", { title, schedule, ...(anchor !== undefined ? { anchorDate: c.day(anchor) } : {}) });
    const id = await idOf("chore", title);
    await madeOn(id, c.day(-21));
    for (const n of doneOn) await complete("chores", id, c.day(n));
  };

  // Overdue by a few days: done once, two weeks and a bit ago.
  await chore("Wash the car", { kind: "interval", days: 14 }, [-17], -17);
  // Weekly, done every week so far, next in a few days.
  await chore("Mop the kitchen floor", { kind: "weekly", weekdays: [weekdayOf(c.day(3))] }, [-18, -11, -4]);
  await chore("Feed the sourdough starter", { kind: "interval", days: 2 }, [-20, -18, -16, -14, -12, -10, -8, -6, -4, -2], -20);
  await chore("Wipe out the fridge", { kind: "interval", days: 10 }, [-14, -4], -14);
  const boiler = parts(c.day(40));
  await chore("Service the boiler", { kind: "yearly", month: boiler.m, day: Math.min(boiler.day, 28) }, []);
}

async function seedRoutine(c: LifeClock): Promise<void> {
  const lesson = await addEventTemplate({
    title: `Portuguese lesson with ${first(luis.name)}`,
    defaultStart: "19:00",
    durationMin: 60,
    notes: "Online, from Porto. Bring the verb list.",
    tags: ["portuguese"],
  });
  const swim = await addEventTemplate({
    title: "Sea swim",
    defaultStart: "08:00",
    durationMin: 90,
    notes: `${PLACES.myrtleville.name}, with a flask of tea.`,
  });
  const boulder = await addEventTemplate({
    title: `Bouldering at ${PLACES.crag.name}`,
    defaultStart: "19:00",
    durationMin: 120,
    notes: `With ${first(marcus.name)}.`,
  });
  await addEventTemplate({ title: `${first(sam.name)}'s case review`, defaultStart: "16:00", durationMin: 45, tags: ["work"] });

  const fromTemplate = (template: string, offset: number) => run("calendar.add-from-template", { template, date: c.day(offset) });

  for (const n of SPAN) {
    const wd = weekdayOf(c.day(n));
    // Today's evening is already climbing (`./agenda`), as is the swim two days ago.
    if (wd === 2 && n !== 0) await fromTemplate(lesson, n);
    if (wd === 6 && n < 0 && n !== -2) await fromTemplate(swim, n);
    if (wd === 4 && n < 0) await fromTemplate(boulder, n);
  }

  await addTimeBlocker({ title: `Clinic hours at ${PLACES.clinic.name}`, weekdays: [1, 2, 3, 4], start: "09:00", end: "17:00" });
}

async function seedMoreEvents(c: LifeClock): Promise<void> {
  const event = (title: string, offset: number, args: Record<string, unknown> = {}) =>
    run("calendar.add-event", { title, date: c.day(offset), ...args });

  await event("NCT test for the car", -16, { start: "09:15", end: "09:45" });
  await event("CPD webinar: tendon loading", -12, { start: "12:30", end: "13:30", tags: ["work"] });
  await event(`${first(aoife.name)}'s show launch drinks`, -9, { start: "19:30", end: "22:00" });
  await event("Running club committee", -7, { start: "20:00", end: "21:00", notes: PLACES.park.name });
  await event("Clinic staff meeting", 3, { start: "08:00", end: "09:00", notes: `${first(sam.name)} wants the booking numbers.` });
  await event("The talk at the running club", 4, { start: "19:30", end: "20:30", notes: `Clubhouse by ${PLACES.park.name}.` });
}
