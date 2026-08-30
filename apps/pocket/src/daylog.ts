import type { DaylogProvider } from "@lifeline/core";
import { APP_ID, POCKET_HREF } from "./domain/types";
import { formatCents } from "./domain/money";
import { useAllowances, useSpends } from "./data/repo";

/** The Daylog Contract for Pocket (ADR 0037): every Spend is a belief of its day — "Spent · Eating out · €12 · lunch". */
export const pocketDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const spends = useSpends();
    const allowances = useAllowances();
    const nameOf = new Map(allowances.map((a) => [a.id, a.name]));
    const tagsOf = new Map(allowances.map((a) => [a.id, a.tags ?? []]));
    return spends
      .filter((s) => s.date === date)
      .map((s) => ({
        key: `${APP_ID}/${s.id}`,
        appId: APP_ID,
        itemId: s.id,
        kind: "Spent",
        title: nameOf.get(s.allowanceId) ?? "Allowance",
        subtitle: s.label ? `${formatCents(s.amount)} · ${s.label}` : formatCents(s.amount),
        href: POCKET_HREF,
        tags: tagsOf.get(s.allowanceId) ?? [],
      }));
  },
};
