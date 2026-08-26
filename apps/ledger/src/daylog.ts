import type { DaylogProvider } from "@lifeline/core";
import { APP_ID, REGISTER_HREF } from "./domain/types";
import { formatCents, formatSigned } from "./domain/money";
import { useAccounts, useCategories, useTransactions } from "./data/repo";

/** The Daylog Contract for the Ledger: every Transaction is a fact of its day. */
export const ledgerDaylog: DaylogProvider = {
  appId: APP_ID,
  useItems(date) {
    const transactions = useTransactions();
    const categories = useCategories();
    const accounts = useAccounts();
    const catOf = new Map(categories.map((c) => [c.id, c.title]));
    const accOf = new Map(accounts.map((a) => [a.id, a.title]));
    return transactions
      .filter((t) => t.date === date)
      .map((t) => {
        const kind = t.kind === "expense" ? "Spent" : t.kind === "income" ? "Received" : t.kind === "transfer" ? "Moved" : "Adjusted";
        const what =
          t.kind === "transfer"
            ? `${accOf.get(t.fromAccountId) ?? "?"} → ${accOf.get(t.toAccountId) ?? "?"}`
            : t.payee || catOf.get(t.categoryId) || (t.kind === "adjustment" ? (accOf.get(t.accountId) ?? "") : "Uncategorized");
        return {
          key: `${APP_ID}/${t.id}`,
          appId: APP_ID,
          itemId: t.id,
          kind,
          title: what,
          subtitle: t.kind === "adjustment" ? formatSigned(t.amount) : formatCents(t.amount),
          href: REGISTER_HREF,
          tags: t.tags ?? [],
        };
      });
  },
};
