import type { DaylogProvider } from "@lifeline/core";
import { APP_ID, SWEARJAR_HREF } from "./domain/types";
import { dayKeyOf, timeOf } from "./domain/derive";
import { formatCents } from "./domain/money";
import { useFines, useOffences } from "./data/repo";

/** The Daylog Contract for the Swear Jar (ADR 0054): every Fine on the day it happened — "Fined · Snoozed the alarm · €2". */
export const swearjarDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const fines = useFines();
    const offences = useOffences();
    const byId = new Map(offences.map((o) => [o.id, o]));
    return fines
      .filter((f) => dayKeyOf(f.occurredAt) === date)
      .map((f) => {
        const o = byId.get(f.offenceId);
        return {
          key: `${APP_ID}/${f.id}`,
          appId: APP_ID,
          itemId: f.id,
          kind: "Fined",
          title: o?.name ?? "Offence",
          subtitle: f.note ? `${formatCents(f.amount)} · ${f.note}` : formatCents(f.amount),
          time: timeOf(f.occurredAt),
          href: SWEARJAR_HREF,
          tags: o?.tags ?? [],
        };
      });
  },
};
