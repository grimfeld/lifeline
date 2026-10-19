import { parts, weekdayOf } from "@lifeline/core";
// The tracking Apps have no headless Command for their definitions (Stats,
// Habits, Negatives, Offences, Exercises, Workouts) nor for a Session, so the
// Demo uses each App's own data functions, which keep its invariants.
import { addStat } from "@lifeline/app-stats/src/data/repo";
import type { ColorSlot, StatKind } from "@lifeline/app-stats/src/domain/types";
import { addHabit, addNegative } from "@lifeline/app-lifelevel/src/data/repo";
import { addOffence } from "@lifeline/app-swearjar/src/data/repo";
import { addExercise, addWorkout, getWorkout, saveSession } from "@lifeline/app-workout/src/data/repo";
import type { BlockResult } from "@lifeline/app-workout/src/domain/types";
import { PEOPLE, PLACES, type LifeClock } from "../persona";
import { run } from "./act";

/**
 * The tracking slice of the Demo life: Stats, Life Level, Mood, Workout and
 * the Swear jar, with five weeks of history so charts, heatmaps and streaks
 * look alive. Streaks belong to boolean Stats and run up to yesterday, so the
 * visitor can tick the visit day themselves.
 *
 * History is varied but fixed (no randomness): the same visit day always
 * seeds the same life.
 */
export async function seedTracking(c: LifeClock): Promise<void> {
  const minutes = await seedStats(c);
  const strength = await seedLifeLevel(c);
  await seedWorkouts(c, { minutes, strength });
  await seedMoods(c);
  await seedSwearJar(c);
}

/** Days of history, from the oldest. */
const HISTORY = 35;
/** A fixed, irregular wobble in [0, n) for day `offset` — believable variety without Math.random. */
const wobble = (offset: number, n: number) => ((offset * 7919) % 31 + 31) % 31 % n;

/** Log a Stat Entry on a past day (at noon for yes/no Stats). */
const log = (stat: string, offset: number, c: LifeClock, extra: Record<string, unknown> = {}) =>
  run("stats.log", { stat, date: c.day(offset), ...extra });

/** Returns the id of the "Training minutes" Stat, which Workouts feed. */
async function seedStats(c: LifeClock): Promise<string> {
  const stat = (title: string, kind: StatKind, more: Partial<{ unit: string; color: ColorSlot; defaultIncrement: number; items: string[] }> = {}) =>
    addStat({
      title,
      kind,
      unit: more.unit ?? "",
      color: more.color ?? "blue",
      defaultIncrement: more.defaultIncrement ?? 0,
      universeSize: 0,
      items: more.items ?? [],
      tags: [],
    });

  // Yes/no: a few early misses, then unbroken from eleven days ago to yesterday.
  const stretching = await stat("Stretching", "boolean", { color: "green" });
  const missed = new Set([-33, -29, -26, -22, -18, -15, -12]);
  for (let n = -HISTORY; n < 0; n++) if (!missed.has(n)) await log(stretching, n, c);

  // Portuguese with Luís on Tuesdays, plus practice most other days; a short live streak.
  const portuguese = await stat("Portuguese practice", "boolean", { color: "violet" });
  for (let n = -HISTORY; n < 0; n++) {
    if (weekdayOf(c.day(n)) === 2 || n >= -4 || wobble(n, 3) !== 0) await log(portuguese, n, c);
  }

  const water = await stat("Water", "additive", { unit: "glasses", color: "aqua", defaultIncrement: 1 });
  for (let n = -28; n < 0; n++) await log(water, n, c, { value: 5 + wobble(n, 4), time: "21:00" });
  // This morning's first two glasses, if the morning has started.
  if (c.isPast(c.moment(0, "08:30"))) await log(water, 0, c, { value: 2, time: "08:30" });

  // A physio watches her own resting heart rate: a slow drift down as the training builds.
  const heart = await stat("Resting heart rate", "measurement", { unit: "bpm", color: "red" });
  for (let n = -HISTORY; n < 0; n += 2 + wobble(n, 2)) {
    await log(heart, n, c, { value: 61 - Math.round((n + HISTORY) / 8) + wobble(n, 3), time: "07:10" });
  }

  const minutes = await stat("Training minutes", "additive", { unit: "min", color: "orange" });

  const spots = await stat("West Cork swim spots", "collection", {
    color: "yellow",
    items: [PLACES.myrtleville.name, "Fountainstown", "Garrettstown", "Inchydoney", "Lough Hyne", "Barleycove"],
  });
  await log(spots, -31, c, { item: PLACES.myrtleville.name });
  await log(spots, -17, c, { item: "Fountainstown" });
  await log(spots, -10, c, { item: "Garrettstown" });

  return minutes;
}

/** Returns the id of the "Strength training" Habit, which Workouts feed. */
async function seedLifeLevel(c: LifeClock): Promise<string> {
  const mobility = await addHabit({ title: "Morning mobility", difficulty: "easy", tags: [] });
  const reading = await addHabit({ title: "Read before bed", difficulty: "normal", tags: [] });
  const strength = await addHabit({ title: "Strength training", difficulty: "hard", tags: [] });
  const cooking = await addHabit({ title: "Cook from scratch", difficulty: "normal", tags: [] });

  const complete = (habit: string, offset: number, time: string, note = "") =>
    run("lifelevel.complete", { habit, date: c.day(offset), time, ...(note ? { note } : {}) });

  for (let n = -28; n < 0; n++) {
    if (wobble(n, 6) !== 0) await complete(mobility, n, "07:20");
    if (wobble(n + 3, 4) !== 0) await complete(reading, n, "22:40");
    if (wobble(n + 1, 3) !== 0) await complete(cooking, n, "19:30", n === -6 ? `Dahl for ${PEOPLE.priya.name.split(" ")[0]}, swapped for a loaf.` : "");
  }
  // Strength training is mostly logged by the Workouts' Tallies; the climbing nights by hand.
  for (let n = -28; n < 0; n++) {
    const wd = weekdayOf(c.day(n));
    if (wd === 2 || wd === 4) await complete(strength, n, "21:00", `Climbing at ${PLACES.crag.name}`);
  }
  if (c.isPast(c.moment(0, "07:20"))) await complete(mobility, 0, "07:20");

  const doomscroll = await addNegative({ title: "Doomscrolling in bed", gravity: "minor", affectsHabitId: reading, tags: [] });
  const takeaway = await addNegative({ title: "Weeknight takeaway", gravity: "minor", affectsHabitId: cooking, tags: [] });
  const negative = (id: string, offset: number, time: string) => run("lifelevel.log-negative", { negative: id, date: c.day(offset), time });
  await negative(doomscroll, -19, "00:50");
  await negative(doomscroll, -8, "01:10");
  await negative(takeaway, -13, "20:15");
  await negative(takeaway, -3, "20:40");

  return strength;
}

async function seedWorkouts(c: LifeClock, feeds: { minutes: string; strength: string }): Promise<void> {
  const swing = await addExercise({ title: "Kettlebell swing", category: "full-body", measure: "load", equipment: "Kettlebell" });
  const pushup = await addExercise({ title: "Push-up", category: "push", measure: "reps" });
  const goblet = await addExercise({ title: "Goblet squat", category: "legs", measure: "load", equipment: "Kettlebell" });
  const pullup = await addExercise({ title: "Pull-up", category: "pull", measure: "reps", equipment: "Bar" });
  const row = await addExercise({ title: "Row", category: "cardio", measure: "distance", equipment: "Rowing machine" });
  await addExercise({ title: "Hollow hold", category: "core", measure: "time", notes: "Lower back pressed down; it's the whole point." });

  const mv = (exerciseId: string, dose: Partial<{ reps: number; load: number; distance: number; seconds: number }>, cue = "") => ({
    exerciseId,
    reps: dose.reps ?? null,
    load: dose.load ?? null,
    seconds: dose.seconds ?? null,
    distance: dose.distance ?? null,
    calories: null,
    cue,
  });
  // Every Session counts towards Strength training and adds its minutes to the Stat.
  const tallies = [
    { target: `lifelevel/${feeds.strength}`, value: "one" },
    { target: `stats/${feeds.minutes}`, value: "duration" },
  ];

  const emom = await getWorkout(
    await addWorkout({
      title: "Lunchtime EMOM",
      notes: `Fits between patients in the gym at ${PLACES.clinic.name}.`,
      blocks: [
        {
          id: "emom",
          mode: "emom",
          label: "Swings and push-ups",
          rounds: 12,
          every: 60,
          work: 0,
          rest: 0,
          cap: 0,
          movements: [mv(swing, { reps: 15, load: 16 }, "Hips, not arms"), mv(pushup, { reps: 10 })],
        },
      ],
      tallies,
    }),
  );
  const amrap = await getWorkout(
    await addWorkout({
      title: "Saturday AMRAP",
      notes: "Before the swim, if the tide allows.",
      blocks: [
        {
          id: "amrap",
          mode: "amrap",
          label: "Twenty minutes",
          rounds: 0,
          every: 60,
          work: 0,
          rest: 0,
          cap: 20 * 60,
          movements: [mv(goblet, { reps: 12, load: 20 }), mv(pullup, { reps: 5 }), mv(row, { distance: 250 })],
        },
      ],
      tallies,
    }),
  );
  if (!emom || !amrap) throw new Error("Demo life: the Workouts did not save");

  const emomResult = (load: number): BlockResult[] => [
    {
      blockId: "emom",
      mode: "emom",
      rounds: 12,
      extraReps: null,
      seconds: null,
      movements: [
        { exerciseId: swing, reps: 15, load, seconds: null, distance: null, calories: null },
        { exerciseId: pushup, reps: 10, load: null, seconds: null, distance: null, calories: null },
      ],
    },
  ];
  const amrapResult = (rounds: number, extraReps: number): BlockResult[] => [
    {
      blockId: "amrap",
      mode: "amrap",
      rounds,
      extraReps,
      seconds: null,
      movements: [
        { exerciseId: goblet, reps: 12, load: 20, seconds: null, distance: null, calories: null },
        { exerciseId: pullup, reps: 5, load: null, seconds: null, distance: null, calories: null },
        { exerciseId: row, reps: null, load: null, seconds: null, distance: 250, calories: null },
      ],
    },
  ];

  // Lunchtime EMOMs on Mondays and Wednesdays, the AMRAP on Saturday mornings: three weeks of them.
  for (let n = -21; n < 0; n++) {
    const wd = weekdayOf(c.day(n));
    if (wd === 1 || wd === 3) {
      await saveSession({ workout: emom, startedAt: c.moment(n, "12:45"), endedAt: c.moment(n, "13:00"), results: emomResult(n < -10 ? 16 : 20) });
    } else if (wd === 6) {
      await saveSession({
        workout: amrap,
        startedAt: c.moment(n, "08:00"),
        endedAt: c.moment(n, "08:24"),
        results: amrapResult(n < -10 ? 5 : 6, 4 + wobble(n, 8)),
        notes: n >= -7 ? `Swim after at ${PLACES.myrtleville.name}; the sea was eleven degrees.` : "",
      });
    }
  }
}

const MOODS = ["rough", "meh", "okay", "good", "great"] as const;

async function seedMoods(c: LifeClock): Promise<void> {
  // Mostly okay to good, the odd rough day, Saturdays at the sea a little better; a few days not recorded.
  const pattern = [3, 4, 3, 4, 4, 2, 3, 4, 5, 3, 4, 3, 1, 3, 4, 4, 3, 5, 4, 2, 4, 3, 4, 4, 3, 5, 4, 3, 4, 3, 2, 4, 4, 3, 4];
  for (let n = -HISTORY; n < 0; n++) {
    if (wobble(n, 7) === 0) continue;
    let level = pattern[n + HISTORY];
    if (weekdayOf(c.day(n)) === 6) level = Math.min(5, level + 1);
    await run("mood.set", { mood: MOODS[level - 1], date: c.day(n) });
  }
  // Early in a month, the month's grid would be nearly empty: today is already felt.
  if (parts(c.today).day <= 3) await run("mood.set", { mood: "good" });
}

async function seedSwearJar(c: LifeClock): Promise<void> {
  await addOffence({ name: "Swearing", price: 100, emoji: "🤬", color: "red" });
  await addOffence({ name: "Late for a session", price: 200, emoji: "⏰", color: "orange" });
  await addOffence({ name: "Doomscrolling past midnight", price: 150, emoji: "📱", color: "violet" });
  await addOffence({ name: "Forgot my water bottle", price: 50, emoji: "💧", color: "aqua" });

  const fine = (offence: string, offset: number, time: string, note = "") =>
    run("swearjar.fine", { offence, date: c.day(offset), time, ...(note ? { note } : {}) });

  // Spread over this month and the last, so the jar and the month switcher both have something.
  await fine("Swearing", -38, "17:20", "Stubbed a toe on the treatment table.");
  await fine("Forgot my water bottle", -34, "09:05");
  await fine("Late for a session", -29, "08:10", `Bridge traffic; ${PEOPLE.sam.name.split(" ")[0]} noticed.`);
  await fine("Doomscrolling past midnight", -24, "00:45");
  await fine("Swearing", -19, "18:30", "The printer, again.");
  await fine("Forgot my water bottle", -12, "13:10");
  await fine("Swearing", -7, "19:40", "Fell off the last move of the green problem.");
  await fine("Late for a session", -4, "14:05");
  await fine("Forgot my water bottle", -2, "08:50");
  // Last night ran over: the first fine of the visit day, whatever day of the month it is.
  if (c.isPast(c.moment(0, "00:40"))) await fine("Doomscrolling past midnight", 0, "00:40");
}
