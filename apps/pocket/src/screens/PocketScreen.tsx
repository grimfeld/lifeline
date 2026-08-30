import { useMemo, useState } from "react";
import { Button, Card, CardContent, toast } from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import { ChevronDown, ChevronRight, Plus, RefreshCw, Wallet } from "lucide-react";
import type { Allowance, Bucket, Spend } from "../domain/types";
import { allowanceRows, renewable, sortRows, canRenew, type AllowanceRow } from "../domain/derive";
import { daysLeft, periodLabel } from "../domain/period";
import { formatCents } from "../domain/money";
import { renewAllowance, useAllowances, useSpends } from "../data/repo";
import { AllowanceEditorDialog } from "../components/AllowanceEditorDialog";
import { SpendDialog } from "../components/SpendDialog";

const BUCKETS: { key: Bucket; title: string; empty: string }[] = [
  { key: "current", title: "Now", empty: "Nothing running today — make an allowance or renew an ended one." },
  { key: "upcoming", title: "Upcoming", empty: "" },
  { key: "past", title: "Past", empty: "" },
];

/**
 * Pocket (ADR 0037): every Allowance in three buckets — running today,
 * starting later, ended — each with what is left, its Spends one click
 * away. Renewal is a tap, never automatic.
 */
export function PocketScreen() {
  const allowances = useAllowances();
  const spends = useSpends();
  const today = todayStr();
  const rows = useMemo(() => sortRows(allowanceRows(allowances, spends, today)), [allowances, spends, today]);
  const ended = useMemo(() => renewable(allowances, today), [allowances, today]);

  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Allowance | undefined>();
  const [spendFor, setSpendFor] = useState<string | undefined>();
  const [spendOpen, setSpendOpen] = useState(false);
  const [editingSpend, setEditingSpend] = useState<Spend | undefined>();
  const [showPast, setShowPast] = useState(false);

  const current = rows.filter((r) => r.bucket === "current");
  const totalLeft = current.reduce((s, r) => s + r.left, 0);
  const totalGranted = current.reduce((s, r) => s + r.allowance.amount, 0);

  async function renewAll() {
    let n = 0;
    for (const a of ended) {
      try {
        await renewAllowance(a, allowances);
        n++;
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
    if (n > 0) toast.success(`Renewed ${n} allowance${n === 1 ? "" : "s"}`);
  }

  function openSpend(allowanceId?: string) {
    setSpendFor(allowanceId);
    setEditingSpend(undefined);
    setSpendOpen(true);
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4">
      <div className="flex items-center gap-2">
        <Wallet className="size-5" />
        <h1 className="flex-1 text-lg font-semibold">Pocket</h1>
        {ended.length > 0 && (
          <Button variant="outline" onClick={() => void renewAll()}>
            <RefreshCw /> Renew {ended.length} ended
          </Button>
        )}
        <Button variant="outline" onClick={() => setNewOpen(true)}>
          <Plus /> New allowance
        </Button>
        <Button onClick={() => openSpend()} disabled={rows.length === 0}>
          <Plus /> Spend
        </Button>
      </div>

      {current.length > 0 && (
        <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            Left now <span className={`font-medium tabular-nums ${totalLeft < 0 ? "text-destructive" : "text-foreground"}`}>{formatCents(totalLeft)}</span>
          </span>
          <span>
            of <span className="text-foreground font-medium tabular-nums">{formatCents(totalGranted)}</span>
          </span>
        </div>
      )}

      {BUCKETS.map(({ key, title, empty }) => {
        const bucketRows = rows.filter((r) => r.bucket === key);
        if (bucketRows.length === 0 && !empty) return null;
        const collapsed = key === "past" && !showPast;
        return (
          <div key={key} className="grid gap-1.5">
            <button className="text-muted-foreground mt-1 flex items-center gap-1 text-left text-xs font-semibold tracking-wide uppercase" onClick={() => key === "past" && setShowPast((v) => !v)} disabled={key !== "past"}>
              {key === "past" && (collapsed ? <ChevronRight className="size-3" /> : <ChevronDown className="size-3" />)}
              {title}
              {key === "past" && <span className="font-normal normal-case">({bucketRows.length})</span>}
            </button>
            {bucketRows.length === 0 && <p className="text-muted-foreground text-sm">{empty}</p>}
            {!collapsed &&
              bucketRows.map((row) => (
                <AllowanceLine
                  key={row.allowance.id}
                  row={row}
                  today={today}
                  renewable={canRenew(row.allowance, allowances)}
                  onEdit={() => setEditing(row.allowance)}
                  onSpend={() => openSpend(row.allowance.id)}
                  onEditSpend={(s) => {
                    setEditingSpend(s);
                    setSpendFor(undefined);
                    setSpendOpen(true);
                  }}
                  onRenew={async () => {
                    try {
                      await renewAllowance(row.allowance, allowances);
                      toast.success(`${row.allowance.name} renewed`);
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              ))}
          </div>
        );
      })}

      <AllowanceEditorDialog open={newOpen} onOpenChange={setNewOpen} />
      <AllowanceEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} allowance={editing} spendCount={editing ? rows.find((r) => r.allowance.id === editing.id)?.spends.length : 0} />
      <SpendDialog open={spendOpen} onOpenChange={setSpendOpen} allowanceId={spendFor} spend={editingSpend} />
    </div>
  );
}

function AllowanceLine({ row, today, renewable, onEdit, onSpend, onEditSpend, onRenew }: { row: AllowanceRow; today: string; renewable: boolean; onEdit: () => void; onSpend: () => void; onEditSpend: (s: Spend) => void; onRenew: () => void }) {
  const [open, setOpen] = useState(false);
  const a = row.allowance;
  const over = row.left < 0;
  const ratio = a.amount > 0 ? Math.min(1, row.spent / a.amount) : row.spent > 0 ? 1 : 0;
  const left = daysLeft(a, today);

  return (
    <Card className="py-0">
      <CardContent className="grid gap-1 px-3 py-2">
        <div className="flex items-center gap-3 text-sm">
          <button className="flex items-center gap-1 text-left" onClick={() => setOpen((v) => !v)} aria-label={open ? "Hide spends" : "Show spends"}>
            {open ? <ChevronDown className="text-muted-foreground size-4" /> : <ChevronRight className="text-muted-foreground size-4" />}
          </button>
          <button className="min-w-0 flex-1 truncate text-left font-medium hover:underline" onClick={onEdit}>
            {a.name}
            <span className="text-muted-foreground ml-2 text-xs font-normal">{periodLabel(a)}</span>
          </button>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatCents(row.spent)} / {formatCents(a.amount)}
          </span>
          <span className={`w-24 text-right font-semibold tabular-nums ${over ? "text-destructive" : ""}`}>{formatCents(row.left)}</span>
          {row.bucket !== "past" && (
            <Button size="sm" variant="outline" onClick={onSpend}>
              Spend
            </Button>
          )}
          {row.bucket === "past" && renewable && (
            <Button size="sm" variant="outline" onClick={onRenew}>
              <RefreshCw /> Renew
            </Button>
          )}
        </div>
        <div className="bg-muted h-1.5 overflow-hidden rounded-full">
          <div className={`h-full ${over ? "bg-destructive" : "bg-primary"}`} style={{ width: `${ratio * 100}%` }} />
        </div>
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>
            {row.spends.length} spend{row.spends.length === 1 ? "" : "s"}
          </span>
          <span>{row.bucket === "current" ? `${left} day${left === 1 ? "" : "s"} left` : row.bucket === "upcoming" ? `starts ${formatHuman(a.from)}` : "ended"}</span>
        </div>
        {open && (
          <div className="mt-1 grid gap-0.5 border-t pt-2">
            {row.spends.length === 0 && <p className="text-muted-foreground text-xs">Nothing spent yet.</p>}
            {row.spends.map((s) => (
              <button key={s.id} className="hover:bg-accent/50 flex items-center gap-3 rounded-sm px-2 py-1 text-left text-sm" onClick={() => onEditSpend(s)}>
                <span className="text-muted-foreground w-28 shrink-0 text-xs">{formatHuman(s.date)}</span>
                <span className="min-w-0 flex-1 truncate">{s.label || <span className="text-muted-foreground">—</span>}</span>
                <span className="tabular-nums">{formatCents(s.amount)}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
