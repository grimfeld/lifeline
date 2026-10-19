import { useState } from "react";
import { Button, CommitField, cn } from "@lifeline/ui";
import { todayStr, type Document } from "@lifeline/core";
import { Pencil, Plus } from "lucide-react";
import { faceColor, type Allowance } from "../domain/types";
import { jarLevel, spendsOf } from "../domain/derive";
import { daysLeft, periodLabel } from "../domain/period";
import { editAmount, formatCents, parseAmount } from "../domain/money";
import { updateAllowance, useSpends, type AllowanceInput } from "../data/repo";
import { AllowanceEditorDialog } from "./AllowanceEditorDialog";
import { Jar } from "./Jar";
import { SpendDialog } from "./SpendDialog";

/** One or more of an Allowance's own Fields written through `updateAllowance`, which checks them and re-derives the title. */
function save(a: Allowance, patch: Partial<AllowanceInput>): Promise<void> {
  return updateAllowance(a, { name: a.name, period: a.period, from: a.from, to: a.to, amount: a.amount, emoji: a.emoji, color: a.color, tags: a.tags, ...patch });
}

/**
 * Pocket's Peek (ADR 0057, editable by ADR 0085): an Allowance seen from
 * wherever a link to it was followed — a daily note's "Eating out · September
 * 2026", a Base — with what is left, how long it has to last, and the one
 * operation that matters: spend from it, without leaving. Its name and amount
 * are edited in place; its period (guarded: snapped to the period's first
 * day) and face in the Allowance's own dialog.
 */
export function AllowancePeek({ doc }: { doc: Document }) {
  const a = doc as Allowance;
  const spends = useSpends();
  const [spending, setSpending] = useState(false);
  const [editing, setEditing] = useState(false);
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
      <div className="grid grid-cols-2 gap-3">
        <CommitField label="Name" value={a.name} onCommit={(name) => save(a, { name })} />
        <CommitField
          label="Amount"
          inputMode="decimal"
          value={editAmount(a.amount)}
          onCommit={(text) => {
            const cents = parseAmount(text);
            if (cents === null || cents <= 0) throw new Error("Amount must be above zero");
            return save(a, { amount: cents });
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => setSpending(true)}>
          <Plus /> Spend
        </Button>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <Pencil /> Period and face…
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
      <AllowanceEditorDialog open={editing} onOpenChange={setEditing} allowance={a} spendCount={own.length} />
    </div>
  );
}
