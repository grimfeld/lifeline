import type { LoggableProvider, LoggableTarget } from "@lifeline/core";
import { addEntry, useStats } from "./data/repo";

/**
 * Loggable (ADR 0031): every Stat but Collections is a target. Additive and
 * Measurement Stats want a number in their unit; a Boolean Stat wants
 * nothing (a day done). Collections need an item name, which a sender has no
 * way to know.
 */
export const statsLoggable: LoggableProvider = {
  appId: "stats",
  useTargets(): LoggableTarget[] {
    return useStats()
      .filter((s) => s.kind !== "collection")
      .map((s) => ({
        key: `stats/${s.id}`,
        appId: "stats",
        id: s.id,
        title: s.title,
        subtitle: s.kind === "boolean" ? "Boolean" : s.unit || s.kind,
        wants: s.kind === "boolean" ? "none" : "number",
        unit: s.kind === "boolean" ? undefined : s.unit || undefined,
      }));
  },
  async log(statId, { at, value }) {
    await addEntry({ statId, value: value ?? 1, ts: at });
  },
};
