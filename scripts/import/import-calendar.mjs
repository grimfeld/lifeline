#!/usr/bin/env node
// calendar (old) → Lifeline `events`.
// Source: --sqlite <path to old pocketbase/pb_data/data.db>  (default: ../calendar/pocketbase/pb_data/data.db)
//     or: CALENDAR_PB_URL (+ optional CALENDAR_EMAIL/CALENDAR_PASSWORD; the old rules were public)
// Timed events: date + start/end as local wall-clock "HH:MM"; all-day: date (+ endDate).
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { PB, arg, deliver, keepId, localDay, localTime, pbToIso, stamp, run } from "./lib.mjs";

await run(async () => {
  async function readSource() {
    const sqlite = arg("sqlite", new URL("../../../calendar/pocketbase/pb_data/data.db", import.meta.url).pathname);
    if (process.env.CALENDAR_PB_URL) {
      const pb = new PB(process.env.CALENDAR_PB_URL);
      if (process.env.CALENDAR_EMAIL) await pb.login(process.env.CALENDAR_EMAIL, process.env.CALENDAR_PASSWORD);
      return pb.all("events");
    }
    if (!existsSync(sqlite)) throw new Error(`No sqlite at ${sqlite} and no CALENDAR_PB_URL`);
    const db = new DatabaseSync(sqlite, { readOnly: true });
    return db.prepare('select id, title, start, "end", all_day, description from events').all();
  }

  const rows = await readSource();
  const events = rows
    .filter((r) => r.start)
    .map((r) => {
      const startIso = pbToIso(r.start);
      const endIso = pbToIso(r.end);
      const allDay = !!r.all_day;
      const date = localDay(startIso);
      const endDay = endIso ? localDay(endIso) : "";
      return stamp({
        id: keepId(r.id),
        title: r.title,
        notes: r.description ?? "",
        date,
        endDate: allDay && endDay && endDay > date ? endDay : null,
        start: allDay ? null : localTime(startIso),
        end: allDay || !endIso ? null : localTime(endIso),
        createdAt: date,
        tags: [],
      });
    });

  await deliver({ events });
});
