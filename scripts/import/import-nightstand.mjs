#!/usr/bin/env node
// nightstand/readlist → Lifeline `media` (type "book").
// Env: NIGHTSTAND_PB_URL (default https://nightstand.fly.dev), NIGHTSTAND_EMAIL, NIGHTSTAND_PASSWORD.
import { PB, deliver, env, keepId, stamp, run } from "./lib.mjs";

await run(async () => {
  const ENGAGEMENT = { UNREAD: "UNSTARTED", READING: "IN_PROGRESS", READ: "DONE", ABANDONED: "ABANDONED" };

  const pb = new PB(env("NIGHTSTAND_PB_URL", "https://nightstand.fly.dev"));
  await pb.login(env("NIGHTSTAND_EMAIL"), env("NIGHTSTAND_PASSWORD"));

  const media = (await pb.all("books", { sort: "created" })).map((b) =>
    stamp({
      id: keepId(b.id),
      type: "book",
      title: b.title,
      creator: b.author ?? "",
      externalKey: b.work_key ? `openlibrary:${b.work_key}` : "",
      coverUrl: b.cover_url ?? "",
      size: b.pages || 0,
      year: b.year || 0,
      acquisition: b.acquisition,
      engagement: ENGAGEMENT[b.engagement] ?? "UNSTARTED",
      studied: !!b.studied,
      reason: b.reason ?? "",
      slot: b.slot || 0,
      addedOn: b.added_on || (b.created ? b.created.slice(0, 10) : ""),
      acquiredOn: b.acquired_on ?? "",
      slottedOn: b.slotted_on ?? "",
      startedOn: b.started_on ?? "",
      finishedOn: b.finished_on ?? "",
      tags: [],
    }),
  );

  await deliver({ media });
});
