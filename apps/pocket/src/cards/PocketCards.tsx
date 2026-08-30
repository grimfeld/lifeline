import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { todayStr, type CardProps } from "@lifeline/core";
import { POCKET_HREF, faceColor, faceOf } from "../domain/types";
import { allowanceRows, jarLevel, sortRows } from "../domain/derive";
import { daysLeft } from "../domain/period";
import { formatCents } from "../domain/money";
import { useAllowances, useSpends } from "../data/repo";
import { SpendDialog } from "../components/SpendDialog";
import { Jar } from "../components/Jar";

/**
 * Allowances (ADR 0037): what is running today and what is left of each —
 * the phone-home glance, one small jar per row. Tapping a row opens the
 * Spend form on it; nothing running links through to Pocket.
 */
export function AllowancesCard(_props: CardProps) {
  const navigate = useNavigate();
  const allowances = useAllowances();
  const spends = useSpends();
  const today = todayStr();
  const rows = useMemo(() => sortRows(allowanceRows(allowances, spends, today)).filter((r) => r.bucket === "current"), [allowances, spends, today]);
  const [spendFor, setSpendFor] = useState<string | undefined>();

  if (rows.length === 0)
    return (
      <button className="text-muted-foreground flex h-full w-full items-center justify-center p-3 text-sm" onClick={() => navigate(POCKET_HREF)}>
        Nothing running today — open Pocket.
      </button>
    );

  return (
    <div className="grid content-start gap-0.5 overflow-y-auto p-2">
      {rows.map((r) => {
        const a = r.allowance;
        const over = r.left < 0;
        const days = daysLeft(a, today);
        return (
          <button key={a.id} className="hover:bg-accent/50 flex items-center gap-2 rounded-sm px-2 py-1 text-left" onClick={() => setSpendFor(a.id)}>
            <Jar level={jarLevel(r)} over={over} color={faceColor(a)} size="sm" />
            <span className="w-5 shrink-0 text-center text-sm leading-none">{faceOf(a)}</span>
            <span className="min-w-0 flex-1 truncate text-sm">{a.name}</span>
            <span className="text-muted-foreground text-[10px] tabular-nums">{days}d</span>
            <span className={`text-xs font-medium tabular-nums ${over ? "text-destructive" : ""}`}>{formatCents(r.left)}</span>
          </button>
        );
      })}
      <SpendDialog open={!!spendFor} onOpenChange={(o) => !o && setSpendFor(undefined)} allowanceId={spendFor} />
    </div>
  );
}
