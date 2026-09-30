import { useState } from "react";
import { Button, cn } from "@lifeline/ui";
import { todayStr, type Document } from "@lifeline/core";
import { Plus } from "lucide-react";
import { faceColor, type Allowance } from "../domain/types";
import { jarLevel, spendsOf } from "../domain/derive";
import { daysLeft, periodLabel } from "../domain/period";
import { formatCents } from "../domain/money";
import { useSpends } from "../data/repo";
import { Jar } from "./Jar";
import { SpendDialog } from "./SpendDialog";

/**
 * Pocket's Peek (ADR 0057): an Allowance seen from wherever a link to it was
 * followed — a daily note's "Eating out · September 2026", a Base — with what
 * is left, how long it has to last, and the one operation that matters: spend
 * from it, without leaving.
 */
export function AllowancePeek({ doc }: { doc: Document }) {
  const a = doc as Allowance;
  const spends = useSpends();
  const [spending, setSpending] = useState(false);
  const own = spendsOf(a.id, spends);
  const spent = own.reduce((s, x) => s + x.amount, 0);
  const left = a.amount - spent;
  const days = daysLeft(a, todayStr());

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <Jar level={jarLevel({ left, allowance: a })} over={left < 0} color={faceColor(a)} size="sm" />
        <div className="flex flex-col">
          <span className={cn("text-2xl font-semibold tabular-nums", left < 0 && "text-destructive")}>
            {left < 0 ? `${formatCents(-left)} over` : `${formatCents(left)} left`}
          </span>
          <span className="text-muted-foreground text-sm">
            of {formatCents(a.amount)} · {periodLabel(a)}
            {days > 0 && ` · ${days} day${days === 1 ? "" : "s"} to go`}
          </span>
        </div>
      </div>
      <div>
        <Button size="sm" onClick={() => setSpending(true)}>
          <Plus /> Spend
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-muted-foreground text-xs font-medium">Spends</span>
        {own.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing spent yet.</p>
        ) : (
          <ul className="flex flex-col text-sm">
            {own.slice(0, 8).map((s) => (
              <li key={s.id} className="flex justify-between gap-3 border-b py-1 last:border-0">
                <span className="text-muted-foreground w-20 shrink-0 tabular-nums">{s.date}</span>
                <span className="min-w-0 flex-1 truncate">{s.label || "—"}</span>
                <span className="tabular-nums">{formatCents(s.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <SpendDialog open={spending} onOpenChange={setSpending} allowanceId={a.id} />
    </div>
  );
}
