import { ChartLine, HandCoins, Landmark, LayoutGrid, PiggyBank, Tag } from "lucide-react";
import { ModuleCard } from "../ModuleCard";
import { handModule, ModuleHomeHeader } from "../handModule";

/**
 * Money's home: the month in one page. What Pocket says is left, what the
 * Budget says is spent, where the money sits, and what the bank will take
 * next — three Apps' Cards side by side, which no one App could show.
 */
function MoneyOverview() {
  const month = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <ModuleHomeHeader title="Money" subtitle={month} />
      <div className="grid gap-4 md:grid-cols-2">
        <ModuleCard cardId="pocket.allowances" title="What's left" />
        <ModuleCard cardId="ledger.budget-month" />
        <ModuleCard cardId="ledger.balances" />
        <ModuleCard cardId="ledger.dues" />
      </div>
    </div>
  );
}

/**
 * Money (ADR 0057), in the order the user works it: what is left this month
 * first, then the ledger's facts, the policy, the long view, and what things
 * cost. Pocket, Ledger and Prices keep their screens and their ownership;
 * Money decides the arrangement and the names ("Transactions", not "Ledger":
 * the Module is the ledger's context).
 */
export const moneyShell = handModule({
  id: "money",
  title: "Money",
  places: [
    { key: "overview", title: "Overview", icon: LayoutGrid, page: "" },
    { key: "pocket", title: "Pocket", icon: HandCoins, screen: "pocket.home" },
    { key: "transactions", title: "Transactions", icon: Landmark, screen: "ledger.register" },
    { key: "budget", title: "Budget", icon: PiggyBank, screen: "ledger.budget" },
    { key: "reports", title: "Reports", icon: ChartLine, screen: "ledger.reports" },
    { key: "prices", title: "Prices", icon: Tag, screen: "prices.home" },
  ],
  pages: [{ path: "", component: MoneyOverview }],
});
