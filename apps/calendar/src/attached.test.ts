import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, initApps } from "@lifeline/core";
import { calendarApp } from "./index";
import { calendarTimed } from "./timed";
import { addEvent, allEvents, setEventWhen, updateEvent } from "./data/repo";
import { addTimeBlocker, allTimeBlockers, rescheduleTimeBlocker } from "./data/blockers";
import { addBlockerTemplate } from "./data/blockerTemplates";
import { attachBlocker, attachedBlockersOf } from "./data/attached";
import type { BlockerSide } from "./domain/types";

initApps([calendarApp]);

beforeEach(async () => {
  await documentsTable().clear();
});

// 2026-08-24 is a Monday.
const dentist = () => addEvent({ title: "Dentist", date: "2026-08-24", start: "09:00", end: "10:00" });
const travel = (min = 30) => addBlockerTemplate({ title: `Travel ${min}`, durationMin: min, color: "blue", tags: ["errand"] });

/** Where a blocker stands now, as the Calendar reads it. */
async function band(id: string) {
  const b = (await allTimeBlockers()).find((x) => x.id === id);
  return b && { date: b.date, start: b.start, endDate: b.endDate, end: b.end };
}

async function event(id: string) {
  const e = (await allEvents()).find((x) => x.id === id);
  return e && { date: e.date, start: e.start, endDate: e.endDate, end: e.end };
}

async function attach(eventId: string, side: BlockerSide, min = 30) {
  return attachBlocker(eventId, await travel(min), side);
}

describe("attachBlocker", () => {
  it("makes a one-off blocker from the template flush before the Event, attached to it", async () => {
    const ev = await dentist();
    const id = await attach(ev, "before");
    const [b] = await allTimeBlockers();
    expect(b).toMatchObject({ id, title: "Travel 30", color: "blue", tags: ["errand"], date: "2026-08-24", start: "08:30", endDate: "2026-08-24", end: "09:00", attachedTo: ev, side: "before" });
    expect((await attachedBlockersOf(ev)).map((x) => x.id)).toEqual([id]);
  });

  it("places an after band from the Event's end, across midnight when it runs past", async () => {
    const ev = await addEvent({ title: "Gig", date: "2026-08-24", start: "21:00", end: "23:45" });
    const id = await attach(ev, "after");
    expect(await band(id)).toEqual({ date: "2026-08-24", start: "23:45", endDate: "2026-08-25", end: "00:15" });
  });

  it("refuses an all-day Event", async () => {
    const ev = await addEvent({ title: "Fair", date: "2026-08-24" });
    await expect(attach(ev, "before")).rejects.toThrow(/all-day/i);
    expect(await allTimeBlockers()).toEqual([]);
  });

  it("takes several blockers on both sides of one Event", async () => {
    const ev = await dentist();
    const prep = await attachBlocker(ev, await addBlockerTemplate({ title: "Prep 15", durationMin: 15 }), "before");
    const there = await attach(ev, "before");
    const back = await attach(ev, "after");
    expect((await attachedBlockersOf(ev)).map((b) => b.id).sort()).toEqual([prep, there, back].sort());
    // Each flush against the Event, stacked as made: both before bands end at its start.
    expect(await band(prep)).toMatchObject({ start: "08:45", end: "09:00" });
    expect(await band(there)).toMatchObject({ start: "08:30", end: "09:00" });
  });
});

describe("an Event moved through the Timed provider takes its attached blockers", () => {
  it("to another hour, keeping each band's side, gap and length", async () => {
    const ev = await dentist();
    const before = await attach(ev, "before");
    const after = await attach(ev, "after", 45);
    await calendarTimed.reschedule!(ev, { date: "2026-08-24", start: "14:00", endDate: "2026-08-24", end: "15:00" });
    expect(await band(before)).toEqual({ date: "2026-08-24", start: "13:30", endDate: "2026-08-24", end: "14:00" });
    expect(await band(after)).toEqual({ date: "2026-08-24", start: "15:00", endDate: "2026-08-24", end: "15:45" });
  });

  it("to another day by `move`", async () => {
    const ev = await dentist();
    const before = await attach(ev, "before");
    await calendarTimed.move!(ev, "2026-08-27");
    expect(await event(ev)).toMatchObject({ date: "2026-08-27", start: "09:00" });
    expect(await band(before)).toEqual({ date: "2026-08-27", start: "08:30", endDate: "2026-08-27", end: "09:00" });
  });

  it("lengthened: only the after bands move, by as much", async () => {
    const ev = await dentist();
    const before = await attach(ev, "before");
    const after = await attach(ev, "after");
    await calendarTimed.reschedule!(ev, { date: "2026-08-24", start: "09:00", endDate: "2026-08-24", end: "11:30" });
    expect(await band(before)).toMatchObject({ start: "08:30", end: "09:00" });
    expect(await band(after)).toMatchObject({ start: "11:30", end: "12:00" });
  });

  it("started earlier: only the before bands move", async () => {
    const ev = await dentist();
    const before = await attach(ev, "before");
    const after = await attach(ev, "after");
    await calendarTimed.reschedule!(ev, { date: "2026-08-24", start: "08:00", endDate: "2026-08-24", end: "10:00" });
    expect(await band(before)).toMatchObject({ start: "07:30", end: "08:00" });
    expect(await band(after)).toMatchObject({ start: "10:00", end: "10:30" });
  });

  it("across midnight and onto a span of days", async () => {
    const ev = await dentist();
    const before = await attach(ev, "before", 60);
    const after = await attach(ev, "after");
    // Now a night flight: Tuesday 00:30 to Wednesday 06:00.
    await calendarTimed.reschedule!(ev, { date: "2026-08-25", start: "00:30", endDate: "2026-08-26", end: "06:00" });
    expect(await band(before)).toEqual({ date: "2026-08-24", start: "23:30", endDate: "2026-08-25", end: "00:30" });
    expect(await band(after)).toEqual({ date: "2026-08-26", start: "06:00", endDate: "2026-08-26", end: "06:30" });
  });

  it("keeps a gap and length set by hand on the band, and its side even when dragged past the Event", async () => {
    const ev = await dentist();
    const b = await attach(ev, "before");
    // Dragged and stretched by hand: the bus leaves earlier, and it is a longer ride.
    await rescheduleTimeBlocker(b, { date: "2026-08-24", start: "07:45", endDate: "2026-08-24", end: "08:30" });
    await calendarTimed.reschedule!(ev, { date: "2026-08-24", start: "11:00", endDate: "2026-08-24", end: "12:00" });
    expect(await band(b)).toMatchObject({ start: "09:45", end: "10:30" });
    // Dragged past the Event's end, it still follows the start.
    await rescheduleTimeBlocker(b, { date: "2026-08-24", start: "12:30", endDate: "2026-08-24", end: "13:00" });
    await calendarTimed.reschedule!(ev, { date: "2026-08-24", start: "11:00", endDate: "2026-08-24", end: "14:00" });
    expect(await band(b)).toMatchObject({ start: "12:30", end: "13:00" });
  });

  it("never moves a plain blocker beside it", async () => {
    const ev = await dentist();
    const plain = await addTimeBlocker({ title: "Travel", date: "2026-08-24", weekdays: [], start: "08:30", end: "09:00" });
    await calendarTimed.reschedule!(ev, { date: "2026-08-24", start: "14:00", endDate: "2026-08-24", end: "15:00" });
    await calendarTimed.move!(ev, "2026-08-27");
    expect(await band(plain)).toEqual({ date: "2026-08-24", start: "08:30", endDate: "2026-08-24", end: "09:00" });
  });

  it("is undone by moving the Event back: Event and bands return together", async () => {
    const ev = await dentist();
    const before = await attach(ev, "before");
    const after = await attach(ev, "after");
    const was = { ev: await event(ev), before: await band(before), after: await band(after) };
    await calendarTimed.reschedule!(ev, { date: "2026-08-25", start: "16:00", endDate: "2026-08-25", end: "18:00" });
    // The Hours editor's Undo puts back the Event's whole span (ADR 0056).
    await calendarTimed.reschedule!(ev, { date: "2026-08-24", start: "09:00", endDate: "2026-08-24", end: "10:00" });
    expect({ ev: await event(ev), before: await band(before), after: await band(after) }).toEqual(was);
  });
});

describe("an Event's time edited in its dialog or Peek takes its attached blockers", () => {
  it("through the Peek's `setEventWhen`", async () => {
    const ev = await dentist();
    const before = await attach(ev, "before");
    const after = await attach(ev, "after");
    await setEventWhen(ev, { date: "2026-08-25", endDate: null, start: "10:00", end: "12:00" });
    expect(await band(before)).toMatchObject({ date: "2026-08-25", start: "09:30", end: "10:00" });
    expect(await band(after)).toMatchObject({ date: "2026-08-25", start: "12:00", end: "12:30" });
  });

  it("through the dialog's `updateEvent`", async () => {
    const ev = await dentist();
    const before = await attach(ev, "before");
    const row = (await allEvents()).find((e) => e.id === ev)!;
    await updateEvent({ ...row, title: "Dentist (moved)", start: "13:00", end: "14:00" });
    expect(await band(before)).toMatchObject({ date: "2026-08-24", start: "12:30", end: "13:00" });
  });
});
