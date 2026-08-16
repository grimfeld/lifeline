#!/usr/bin/env node
// week-planner → Lifeline `tasks` + `task_occurrences`.
// Env: WEEKPLANNER_PB_URL (default http://127.0.0.1:8090 — it was local-only), optional WEEKPLANNER_EMAIL/PASSWORD.
// Weekdays: week-planner used Mon=0…Sun=6; Core uses Sun=0…Sat=6 → (w + 1) % 7.
import { PB, deliver, env, keepId, stamp } from "./lib.mjs";

const pb = new PB(env("WEEKPLANNER_PB_URL", "http://127.0.0.1:8090"));
if (process.env.WEEKPLANNER_EMAIL) await pb.login(process.env.WEEKPLANNER_EMAIL, process.env.WEEKPLANNER_PASSWORD);

const src = await pb.all("tasks", { sort: "created" });
const idMap = new Map(src.map((t) => [t.id, keepId(t.id)]));

const tasks = src.map((t) => {
  const recurring = t.type === "weekly";
  const created = (t.created ?? "").slice(0, 10) || new Date().toISOString().slice(0, 10);
  return stamp({
    id: idMap.get(t.id),
    title: t.title,
    notes: t.notes ?? "",
    status: t.archived ? "archived" : "active",
    date: recurring ? null : t.date || null,
    completedOn: !recurring && t.completed ? t.date || created : null,
    recurrence: recurring ? { kind: "weekly", weekdays: (t.weekdays ?? []).map((w) => (w + 1) % 7).sort() } : null,
    // Old recurring tasks existed for all time; generate from the earliest override or creation.
    createdAt: created,
  });
});

const overrides = await pb.all("task_overrides");
const earliest = new Map();
for (const o of overrides) {
  const [taskId, sourceDate] = String(o.occurrenceId).split("|");
  if (sourceDate && (!earliest.has(taskId) || sourceDate < earliest.get(taskId))) earliest.set(taskId, sourceDate);
}
for (const t of tasks) {
  const srcId = [...idMap].find(([, v]) => v === t.id)?.[0];
  const e = earliest.get(srcId);
  if (t.recurrence && e && e < t.createdAt) t.createdAt = e;
}

const task_occurrences = overrides
  .filter((o) => o.occurrenceId?.includes("|") && (o.movedToDate || o.completed))
  .map((o) => {
    const [taskId, sourceDate] = o.occurrenceId.split("|");
    return stamp({
      id: keepId(o.id),
      taskId: idMap.get(taskId) ?? taskId,
      sourceDate,
      movedTo: o.movedToDate || null,
      completedOn: o.completed ? o.movedToDate || sourceDate : null,
    });
  })
  .filter((o) => o.sourceDate);

await deliver({ tasks, task_occurrences });
