import type { DaylogProvider } from "@lifeline/core";
import { APP_ID, PRICES_HREF } from "./domain/types";
import { linesOf, sumOfLines } from "./domain/derive";
import { formatCents } from "./domain/money";
import { useLines, useReceipts, useShops } from "./data/repo";

/** The Daylog Contract for Prices (ADR 0082): a shopping trip is a fact of its day — "Bought · Lidl · €54.20". */
export const pricesDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const receipts = useReceipts();
    const lines = useLines();
    const shops = useShops();
    const nameOf = new Map(shops.map((s) => [s.id, s.title]));
    return receipts
      .filter((r) => r.date === date)
      .map((r) => {
        const ls = linesOf(lines, r.id);
        const amount = r.total > 0 ? r.total : sumOfLines(ls);
        return {
          key: `${APP_ID}/${r.id}`,
          appId: APP_ID,
          itemId: r.id,
          kind: "Bought",
          title: nameOf.get(r.shopId) ?? "Shop",
          subtitle: `${formatCents(amount)} · ${ls.length} line${ls.length === 1 ? "" : "s"}`,
          href: `${PRICES_HREF}?tab=receipts`,
          tags: r.tags ?? [],
        };
      });
  },
};
