import { ChartLine, HandCoins, Landmark, LayoutGrid, PiggyBank, Tag } from "lucide-react";
import { overviewPage } from "../Overview";
import { handModule } from "../handModule";

/**
 * Money's Overview: the month in one page. What Pocket says is left, what the
 * Budget says is spent, where the money sits, and what the bank will take
 * next — three Apps' Cards side by side, which no one App could show. The
 * default; each Workspace may rearrange it (ADR 0066).
 */
const MoneyOverview = overviewPage({
  moduleId: "money",
  title: "Money",
  subtitle: () => new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }),
  defaults: [
    { cardId: "pocket.allowances", title: "What's left" },
    { cardId: "ledger.budget-month" },
    { cardId: "ledger.balances" },
    { cardId: "ledger.dues" },
  ],
});

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
