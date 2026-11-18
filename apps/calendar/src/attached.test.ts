import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultColumns, documentToText, documentsTable, documentTypeSync, initApps, moveDocumentsToWorkspace, removeDocument } from "@lifeline/core";
import { calendarApp } from "./index";
import { calendarTimed } from "./timed";
import { addEvent, allEvents, setEventWhen, updateEvent } from "./data/repo";
import { addTimeBlocker, allTimeBlockers, rescheduleTimeBlocker } from "./data/blockers";
import { addBlockerTemplate } from "./data/blockerTemplates";
import { attachBlocker, attachedBlockersOf, detachBlocker, liveAttachment } from "./data/attached";
import { TIME_BLOCKER_TYPE, type BlockerSide } from "./domain/types";

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

describe("an attached blocker's life ends or changes with its Event (#519)", () => {
  it("is deleted with the Event through Core's generic delete, and no other blocker is", async () => {
    const ev = await dentist();
    const other = await dentist();
    const before = await attach(ev, "before");
    const after = await attach(ev, "after");
    const mine = await attach(other, "before");
    const plain = await addTimeBlocker({ title: "Plain", date: "2026-08-24", start: "12:00", end: "13:00", weekdays: [] });
    await removeDocument(ev);
    const left = (await allTimeBlockers()).map((b) => b.id);
    expect(left).not.toContain(before);
    expect(left).not.toContain(after);
    expect(left.sort()).toEqual([mine, plain].sort());
  });

  it("comes back, still attached, when the Event's removal from the Schedule is undone", async () => {
    const ev = await dentist();
    const before = await attach(ev, "before");
    const after = await attach(ev, "after");
    const was = await band(before);
    const undo = await calendarTimed.remove!(ev);
    expect(await allTimeBlockers()).toEqual([]);
    await undo();
    expect(await event(ev)).toBeTruthy();
    expect(await band(before)).toEqual(was);
    const back = await attachedBlockersOf(ev);
    expect(back.map((b) => [b.id, b.side]).sort()).toEqual([[before, "before"], [after, "after"]].sort());
  });

  it("is detached, its times unchanged, when the Event is made all day", async () => {
    const ev = await dentist();
    const id = await attach(ev, "before");
    const was = await band(id);
    await setEventWhen(ev, { date: "2026-08-24", endDate: null, start: null, end: null });
    expect(await band(id)).toEqual(was);
    const b = (await allTimeBlockers())[0];
    expect(b!.attachedTo ?? null).toBeNull();
    expect(b!.side ?? null).toBeNull();
    expect(await attachedBlockersOf(ev)).toEqual([]);
  });

  it("is detached too when the Event dialog saves it all day", async () => {
    const ev = await dentist();
    const id = await attach(ev, "after");
    const e = (await allEvents()).find((x) => x.id === ev)!;
    await updateEvent({ ...e, start: null, end: null });
    expect((await allTimeBlockers()).find((b) => b.id === id)!.attachedTo ?? null).toBeNull();
  });

  it("goes with the Event to another Workspace", async () => {
    const ev = await dentist();
    const id = await attach(ev, "before");
    const plain = await addTimeBlocker({ title: "Plain", date: "2026-08-24", start: "12:00", end: "13:00", weekdays: [] });
    await moveDocumentsToWorkspace([ev], "ws1");
    const rows = documentsTable();
    expect((await rows.get(id))?.workspace).toBe("ws1");
    expect((await rows.get(plain))?.workspace ?? "").toBe("");
  });

  it("is kept, and read as detached, when its Event is gone", async () => {
    const ev = await dentist();
    const id = await attach(ev, "before");
    await documentsTable().update(ev, { deleted: 1 });
    const b = (await allTimeBlockers()).find((x) => x.id === id)!;
    expect(b).toBeTruthy();
    expect(await liveAttachment(b)).toBeNull();
  });

  it("never shows its link in a Base or the Vault's text, so a gone Event is never named there", async () => {
    const ev = await dentist();
    const id = await attach(ev, "before");
    await documentsTable().update(ev, { deleted: 1 });
    const b = (await allTimeBlockers()).find((x) => x.id === id)!;
    const def = documentTypeSync(TIME_BLOCKER_TYPE);
    expect(defaultColumns(def)).not.toContain("attachedTo");
    expect(documentToText(b, def)).not.toMatch(/attachedTo|side|before/);
  });
});

describe("a new Event made with blockers attached (its dialog's Before…/After…)", () => {
  it("is written with them, each flush against its side", async () => {
    const t = await travel();
    const ev = await addEvent({ title: "Dentist", date: "2026-08-24", start: "09:00", end: "10:00", attach: [{ templateId: t, side: "before" }, { templateId: t, side: "after" }] });
    const bands = await attachedBlockersOf(ev);
    expect(bands.map((b) => [b.side, b.start, b.end]).sort()).toEqual([["after", "10:00", "10:30"], ["before", "08:30", "09:00"]]);
  });

  it("takes none when it is all day", async () => {
    const ev = await addEvent({ title: "Fair", date: "2026-08-24", attach: [{ templateId: await travel(), side: "before" }] });
    expect(await event(ev)).toBeTruthy();
    expect(await allTimeBlockers()).toEqual([]);
  });

  it("an edited Event takes the ones picked in its dialog against its new time", async () => {
    const ev = await dentist();
    const row = (await allEvents()).find((e) => e.id === ev)!;
    await updateEvent({ ...row, start: "13:00", end: "14:00" }, [{ templateId: await travel(), side: "before" }]);
    expect((await attachedBlockersOf(ev)).map((b) => [b.start, b.end])).toEqual([["12:30", "13:00"]]);
  });

  it("keeps the picks when the Event's row has vanished before the save", async () => {
    const ev = await dentist();
    const row = (await allEvents()).find((e) => e.id === ev)!;
    await removeDocument(ev);
    await updateEvent({ ...row, start: "13:00", end: "14:00" }, [{ templateId: await travel(), side: "before" }]);
    expect(await event(ev)).toMatchObject({ start: "13:00", end: "14:00" });
    expect((await attachedBlockersOf(ev)).map((b) => [b.start, b.end])).toEqual([["12:30", "13:00"]]);
  });
});

describe("detachBlocker", () => {
  it("clears the attachment and leaves the band exactly where it stands; the Event then moves without it", async () => {
    const ev = await dentist();
    const b = await attach(ev, "before");
    const was = await band(b);
    await detachBlocker(b);
    expect(await band(b)).toEqual(was);
    expect((await allTimeBlockers())[0]).toMatchObject({ attachedTo: null, side: null });
    expect(await attachedBlockersOf(ev)).toEqual([]);
    await calendarTimed.reschedule!(ev, { date: "2026-08-24", start: "14:00", endDate: "2026-08-24", end: "15:00" });
    expect(await band(b)).toEqual(was);
  });

  it("is undone by re-attaching on the same side, and the band follows again", async () => {
    const ev = await dentist();
    const b = await attach(ev, "after");
    const undo = await detachBlocker(b);
    await undo();
    expect((await allTimeBlockers())[0]).toMatchObject({ attachedTo: ev, side: "after" });
    await calendarTimed.reschedule!(ev, { date: "2026-08-24", start: "14:00", endDate: "2026-08-24", end: "15:00" });
    expect(await band(b)).toMatchObject({ start: "15:00", end: "15:30" });
  });

  it("leaves the band plain when its Event is gone by the time of the undo", async () => {
    const ev = await dentist();
    const b = await attach(ev, "before");
    const undo = await detachBlocker(b);
    await removeDocument(ev);
    await undo();
    expect((await allTimeBlockers()).find((x) => x.id === b)).toMatchObject({ attachedTo: null, side: null });
  });

  it("refuses a blocker that is gone", async () => {
    await expect(detachBlocker("nope")).rejects.toThrow(/gone/);
  });
});
