#!/usr/bin/env node
// notch → Lifeline `stats` + `stat_entries`.
// Env: NOTCH_PB_URL (default https://notch-pb.fly.dev), NOTCH_EMAIL, NOTCH_PASSWORD.
import { PB, deliver, env, keepId, localDay, pbToIso, stamp, run } from "./lib.mjs";

await run(async () => {
  const pb = new PB(env("NOTCH_PB_URL", "https://notch-pb.fly.dev"));
  await pb.login(env("NOTCH_EMAIL"), env("NOTCH_PASSWORD"));

  const stats = (await pb.all("stats", { sort: "created" })).map((s) =>
    stamp({
      id: keepId(s.id),
      name: s.name,
      kind: s.kind,
      unit: s.unit ?? "",
      color: s.color || "blue",
      defaultIncrement: s.defaultIncrement || 0,
      universeSize: s.universeSize || 0,
      tags: [],
      createdAt: localDay(pbToIso(s.created)),
    }),
  );
  const idMap = new Map((await pb.all("stats")).map((s) => [s.id, keepId(s.id)]));

  const stat_entries = (await pb.all("entries", { sort: "ts" })).map((e) =>
    stamp({
      id: keepId(e.id),
      statId: idMap.get(e.stat) ?? e.stat,
      value: e.value ?? 0,
      item: e.item ?? "",
      ts: new Date(pbToIso(e.ts)).toISOString(),
    }),
  );

  await deliver({ stats, stat_entries });
});
