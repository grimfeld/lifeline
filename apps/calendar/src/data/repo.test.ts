import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { documentsTable, initApps, putDocument } from "@lifeline/core";
import { calendarApp } from "../index";
import { EVENT_TYPE, type Event } from "../domain/types";
import { addEvent, allEvents } from "./repo";

initApps([calendarApp]);

beforeEach(async () => {
  await documentsTable().clear();
});

/** The one Event there is, as the Calendar reads it. */
async function only(): Promise<Event> {
  const [e, ...rest] = await allEvents();
  expect(rest).toEqual([]);
  return e!;
}

describe("addEvent", () => {
  it("stores an all-day Event with defaults: no notes, no end day, no times, no Tags, nobody with", async () => {
    await addEvent({ title: "Fair", date: "2026-05-02" });
    expect(await only()).toMatchObject({ title: "Fair", notes: "", date: "2026-05-02", endDate: null, start: null, end: null, tags: [], with: [] });
  });

  it("keeps the last day of an all-day Event that runs past its first", async () => {
    await addEvent({ title: "Trip", date: "2026-05-02", endDate: "2026-05-04" });
    expect(await only()).toMatchObject({ date: "2026-05-02", endDate: "2026-05-04", start: null, end: null });
  });

  it("drops an end day that is not after the first day", async () => {
    await addEvent({ title: "Trip", date: "2026-05-02", endDate: "2026-05-02" });
    expect((await only()).endDate).toBeNull();
    await documentsTable().clear();
    await addEvent({ title: "Trip", date: "2026-05-02", endDate: "2026-05-01" });
    expect((await only()).endDate).toBeNull();
  });

  it("keeps a timed Event's times and the day its end is on (ADR 0090)", async () => {
    await addEvent({ title: "Night flight", date: "2026-05-02", endDate: "2026-05-03", start: "22:00", end: "06:00" });
    expect(await only()).toMatchObject({ date: "2026-05-02", endDate: "2026-05-03", start: "22:00", end: "06:00" });
  });

  it("drops the end day of a timed Event with no end time", async () => {
    await addEvent({ title: "Open-ended", date: "2026-05-02", endDate: "2026-05-03", start: "22:00" });
    expect(await only()).toMatchObject({ date: "2026-05-02", endDate: null, start: "22:00", end: null });
  });

  it("drops an end time without a start time", async () => {
    await addEvent({ title: "Fair", date: "2026-05-02", start: "", end: "18:00" });
    expect(await only()).toMatchObject({ start: null, end: null });
  });

  it("stores an end at midnight as 00:00 the next day", async () => {
    await addEvent({ title: "Party", date: "2026-05-02", start: "20:00", end: "24:00" });
    expect(await only()).toMatchObject({ date: "2026-05-02", endDate: "2026-05-03", start: "20:00", end: "00:00" });
  });

  it("stores its notes and normalized Tags", async () => {
    await addEvent({ title: "Fair", date: "2026-05-02", notes: "Bring cash", tags: ["Market", "market"] });
    expect(await only()).toMatchObject({ notes: "Bring cash", tags: ["market"] });
  });

  it("stores the People it was with, each once", async () => {
    await addEvent({ title: "Dinner", date: "2026-05-02", with: ["ana", "ben", "ana"] });
    expect((await only()).with).toEqual(["ana", "ben"]);
  });
});

describe("reading an Event", () => {
  it("re-establishes nulls and lists from what PocketBase hands back blank", async () => {
    await putDocument<Event>({ type: EVENT_TYPE, title: "Old", date: "2026-05-02", endDate: "", start: "", end: "" } as unknown as Event);
    expect(await only()).toMatchObject({ notes: "", endDate: null, start: null, end: null, tags: [], with: [] });
  });

  it("reads the People it was with as ids, skipping blanks, and none from a value that is not a list", async () => {
    await putDocument<Event>({ type: EVENT_TYPE, title: "Dinner", date: "2026-05-02", with: ["ana", "", 7] } as unknown as Event);
    expect((await only()).with).toEqual(["ana", "7"]);
    await documentsTable().clear();
    await putDocument<Event>({ type: EVENT_TYPE, title: "Dinner", date: "2026-05-02", with: "ana" } as unknown as Event);
    expect((await only()).with).toEqual([]);
  });

  it("reads an old 24:00 end as 00:00 the next day (ADR 0090)", async () => {
    await putDocument<Event>({ type: EVENT_TYPE, title: "Party", date: "2026-05-02", endDate: null, start: "20:00", end: "24:00" } as unknown as Event);
    expect(await only()).toMatchObject({ endDate: "2026-05-03", end: "00:00" });
  });
});
