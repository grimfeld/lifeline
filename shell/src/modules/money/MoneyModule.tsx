import type { ComponentType, ReactNode } from "react";
import { NavLink } from "react-router";
import { cn } from "@lifeline/ui";
import { screenRoute, screensOf } from "@lifeline/core";
import { ChartLine, HandCoins, Landmark, LayoutGrid, PiggyBank, Tag } from "lucide-react";
import { ModuleCard } from "../ModuleCard";
import { navRowClass, RawDataLinks } from "../RawDataLinks";
import type { ModuleShell } from "../shells";

type Icon = ComponentType<{ className?: string }>;

interface MoneyPlace {
  key: string;
  title: string;
  icon: Icon;
  /** A route, or the id of the App screen that is this place. */
  to?: string;
  screen?: string;
}

/**
 * Money's places, in the order the user works them (ADR 0057): what is left
 * this month first, then the ledger's facts, the policy, the long view, and
 * what things cost. The Apps behind them — Pocket, Ledger, Prices — keep their
 * screens and their ownership; Money decides only the arrangement and the
 * names ("Transactions", not "Ledger": the Module is the ledger's context).
 */
const PLACES: MoneyPlace[] = [
  { key: "overview", title: "Overview", icon: LayoutGrid, to: "/module/money" },
  { key: "pocket", title: "Pocket", icon: HandCoins, screen: "pocket.home" },
  { key: "transactions", title: "Transactions", icon: Landmark, screen: "ledger.register" },
  { key: "budget", title: "Budget", icon: PiggyBank, screen: "ledger.budget" },
  { key: "reports", title: "Reports", icon: ChartLine, screen: "ledger.reports" },
  { key: "prices", title: "Prices", icon: Tag, screen: "prices.home" },
];

/** A place's route; a place whose App screen is not registered is skipped. */
function hrefOf(p: MoneyPlace): string | undefined {
  if (p.to) return p.to;
  const s = screensOf().find((x) => x.id === p.screen);
  return s && screenRoute(s);
}

function places(): (MoneyPlace & { href: string })[] {
  return PLACES.flatMap((p) => {
    const href = hrefOf(p);
    return href ? [{ ...p, href }] : [];
  });
}

/** Money's navigation: its places, then its raw data. The desk's sidebar and the phone drawer's. */
function MoneyNav() {
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-2">
      <div className="px-2 pt-1 text-base font-semibold tracking-tight">Money</div>
      <div className="flex flex-col gap-0.5">
        {places().map((p) => (
          <NavLink key={p.key} to={p.href} end className={navRowClass}>
            <p.icon className="size-4" /> {p.title}
          </NavLink>
        ))}
      </div>
      <RawDataLinks moduleId="money" />
    </nav>
  );
}

/** On the phone Money's places are tabs across the top — the Phone bar is Core's. */
function MoneyTabs() {
  return (
    <div className="flex shrink-0 gap-1 overflow-x-auto border-b px-2 py-1.5 md:hidden">
      {places().map((p) => (
        <NavLink
          key={p.key}
          to={p.href}
          end
          className={({ isActive }) =>
            cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs whitespace-nowrap",
              isActive ? "bg-accent text-accent-foreground border-transparent font-medium" : "text-muted-foreground",
            )
          }
        >
          <p.icon className="size-3.5" /> {p.title}
        </NavLink>
      ))}
    </div>
  );
}

function MoneyLayout({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  return (
    <>
      <aside className="bg-sidebar text-sidebar-foreground flex w-56 shrink-0 flex-col border-r max-md:hidden">
        <MoneyNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <MoneyTabs />
        <main className={cn("min-w-0 flex-1", bare ? "overflow-hidden" : "overflow-y-auto")}>{children}</main>
      </div>
    </>
  );
}

/**
 * Money's home: the month in one page. What Pocket says is left, what the
 * Budget says is spent, where the money sits, and what the bank will take
 * next — four Apps' Cards side by side, which no one App could show.
 */
function MoneyOverview() {
  const month = new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 md:p-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Money</h1>
        <span className="text-muted-foreground text-sm capitalize">{month}</span>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <ModuleCard cardId="pocket.allowances" title="What's left" />
        <ModuleCard cardId="ledger.budget-month" />
        <ModuleCard cardId="ledger.balances" />
        <ModuleCard cardId="ledger.dues" />
      </div>
    </div>
  );
}

export const moneyShell: ModuleShell = {
  Layout: MoneyLayout,
  Nav: MoneyNav,
  pages: [{ path: "", component: MoneyOverview }],
};
