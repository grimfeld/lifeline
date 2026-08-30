import { useMemo, useState } from "react";
import { Button, Card, CardContent, cn, toast } from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import { ChevronDown, ChevronRight, Pencil, Plus, RefreshCw, Wallet, X } from "lucide-react";
import { faceColor, faceOf, type Allowance, type Bucket, type Spend } from "../domain/types";
import { allowanceRows, renewable, sortRows, canRenew, jarLevel, type AllowanceRow } from "../domain/derive";
import { daysLeft, periodLabel } from "../domain/period";
import { formatCents } from "../domain/money";
import { renewAllowance, useAllowances, useSpends } from "../data/repo";
import { AllowanceEditorDialog } from "../components/AllowanceEditorDialog";
import { SpendDialog } from "../components/SpendDialog";
import { Jar } from "../components/Jar";

const BUCKETS: { key: Bucket; title: string; empty: string }[] = [
  { key: "current", title: "Now", empty: "Nothing running today — make an allowance or renew an ended one." },
  { key: "upcoming", title: "Upcoming", empty: "" },
  { key: "past", title: "Past", empty: "" },
];

/**
 * Pocket (ADR 0037): every Allowance in three buckets — running today,
 * starting later, ended — each with what is left, its Spends one click
 * away. Renewal is a tap, never automatic. What runs today stands as a shelf
 * of jars (CONTEXT: Allowance's face), draining as Spends land; the rest are
 * rows with a small jar in the margin.
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
  const [openTile, setOpenTile] = useState<string | undefined>();

  const current = rows.filter((r) => r.bucket === "current");
  const totalLeft = current.reduce((s, r) => s + r.left, 0);
  const totalGranted = current.reduce((s, r) => s + r.allowance.amount, 0);
  const openRow = openTile ? current.find((r) => r.allowance.id === openTile) : undefined;

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

  function editSpend(s: Spend) {
    setEditingSpend(s);
    setSpendFor(undefined);
    setSpendOpen(true);
  }

  async function renew(a: Allowance) {
    try {
      await renewAllowance(a, allowances);
      toast.success(`${a.name} renewed`);
    } catch (err) {
      toast.error((err as Error).message);
    }
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
            {key === "current" && bucketRows.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {bucketRows.map((row) => (
                    <JarTile key={row.allowance.id} row={row} today={today} open={openTile === row.allowance.id} onEdit={() => setEditing(row.allowance)} onSpend={() => openSpend(row.allowance.id)} onToggle={() => setOpenTile((v) => (v === row.allowance.id ? undefined : row.allowance.id))} />
                  ))}
                </div>
                {openRow && <SpendsPanel row={openRow} onClose={() => setOpenTile(undefined)} onSpend={() => openSpend(openRow.allowance.id)} onEdit={() => setEditing(openRow.allowance)} onEditSpend={editSpend} />}
              </>
            )}
            {key !== "current" && !collapsed && bucketRows.map((row) => <AllowanceLine key={row.allowance.id} row={row} today={today} renewable={canRenew(row.allowance, allowances)} onEdit={() => setEditing(row.allowance)} onSpend={() => openSpend(row.allowance.id)} onEditSpend={editSpend} onRenew={() => void renew(row.allowance)} />)}
          </div>
        );
      })}

      <AllowanceEditorDialog open={newOpen} onOpenChange={setNewOpen} />
      <AllowanceEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} allowance={editing} spendCount={editing ? rows.find((r) => r.allowance.id === editing.id)?.spends.length : 0} />
      <SpendDialog open={spendOpen} onOpenChange={setSpendOpen} allowanceId={spendFor} spend={editingSpend} />
    </div>
  );
}

/** A running Allowance as a jar on the shelf: tap the jar to spend, the name to edit, the footer for its Spends. */
function JarTile({ row, today, open, onEdit, onSpend, onToggle }: { row: AllowanceRow; today: string; open: boolean; onEdit: () => void; onSpend: () => void; onToggle: () => void }) {
  const a = row.allowance;
  const over = row.left < 0;
  const left = daysLeft(a, today);
  const n = row.spends.length;
  return (
    <Card className={cn("relative py-0", open && "ring-ring ring-1")}>
      <button className="text-muted-foreground hover:text-foreground hover:bg-accent absolute top-1.5 right-1.5 rounded-md p-1.5" onClick={onEdit} aria-label={`Edit ${a.name}`} title="Edit">
        <Pencil className="size-3.5" />
      </button>
      <CardContent className="grid justify-items-center gap-1 px-2 py-3 text-center">
        <button className="group grid justify-items-center gap-1 rounded-md px-2 pt-1" onClick={onSpend} aria-label={`Spend from ${a.name}`} title="Spend">
          <span className="relative">
            <Jar level={jarLevel(row)} over={over} color={faceColor(a)} className="motion-safe:transition-transform motion-safe:group-hover:scale-105" />
            <span className="pointer-events-none absolute inset-x-0 top-[39px] text-2xl leading-none drop-shadow-sm">{faceOf(a)}</span>
          </span>
          <span className={cn("text-xl font-semibold tabular-nums", over && "text-destructive")}>{formatCents(row.left)}</span>
        </button>
        <button className="group grid w-full justify-items-center rounded-md px-1 leading-tight" onClick={onEdit} title="Edit">
          <span className="w-full truncate text-sm font-medium group-hover:underline">{a.name}</span>
          <span className="text-muted-foreground text-xs">{periodLabel(a)}</span>
        </button>
        <span className="text-muted-foreground text-xs">
          {left} day{left === 1 ? "" : "s"} left
        </span>
        <button className="text-muted-foreground hover:text-foreground mt-1 flex items-center gap-1 text-xs" onClick={onToggle} aria-expanded={open}>
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {n} spend{n === 1 ? "" : "s"} · {formatCents(row.spent)}
        </button>
      </CardContent>
    </Card>
  );
}

/** The Spends of the open jar, beneath the shelf — too narrow to live inside a tile. */
function SpendsPanel({ row, onClose, onSpend, onEdit, onEditSpend }: { row: AllowanceRow; onClose: () => void; onSpend: () => void; onEdit: () => void; onEditSpend: (s: Spend) => void }) {
  const a = row.allowance;
  return (
    <Card className="py-0">
      <CardContent className="grid gap-1 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-base leading-none">{faceOf(a)}</span>
          <span className="min-w-0 flex-1 truncate font-medium">
            {a.name}
            <span className="text-muted-foreground ml-2 text-xs font-normal">{periodLabel(a)}</span>
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatCents(row.spent)} / {formatCents(a.amount)}
          </span>
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Pencil /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={onSpend}>
            <Plus /> Spend
          </Button>
          <Button size="icon" variant="ghost" className="size-7" onClick={onClose} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>
        <SpendList spends={row.spends} onEditSpend={onEditSpend} />
      </CardContent>
    </Card>
  );
}

function SpendList({ spends, onEditSpend }: { spends: Spend[]; onEditSpend: (s: Spend) => void }) {
  return (
    <div className="mt-1 grid gap-0.5 border-t pt-2">
      {spends.length === 0 && <p className="text-muted-foreground text-xs">Nothing spent yet.</p>}
      {spends.map((s) => (
        <button key={s.id} className="hover:bg-accent/50 flex items-center gap-3 rounded-sm px-2 py-1 text-left text-sm" onClick={() => onEditSpend(s)}>
          <span className="text-muted-foreground w-28 shrink-0 text-xs">{formatHuman(s.date)}</span>
          <span className="min-w-0 flex-1 truncate">{s.label || <span className="text-muted-foreground">—</span>}</span>
          <span className="tabular-nums">{formatCents(s.amount)}</span>
        </button>
      ))}
    </div>
  );
}

/** An upcoming or ended Allowance as a row, its jar small in the margin. */
function AllowanceLine({ row, today, renewable, onEdit, onSpend, onEditSpend, onRenew }: { row: AllowanceRow; today: string; renewable: boolean; onEdit: () => void; onSpend: () => void; onEditSpend: (s: Spend) => void; onRenew: () => void }) {
  const [open, setOpen] = useState(false);
  const a = row.allowance;
  const over = row.left < 0;
  const left = daysLeft(a, today);

  return (
    <Card className="py-0">
      <CardContent className="grid gap-1 px-3 py-2">
        <div className="flex items-center gap-3 text-sm">
          <button className="flex items-center gap-1 text-left" onClick={() => setOpen((v) => !v)} aria-label={open ? "Hide spends" : "Show spends"}>
            {open ? <ChevronDown className="text-muted-foreground size-4" /> : <ChevronRight className="text-muted-foreground size-4" />}
          </button>
          <Jar level={jarLevel(row)} over={over} color={faceColor(a)} size="sm" />
          <span className="w-5 shrink-0 text-center text-base leading-none">{faceOf(a)}</span>
          <button className="group flex min-w-0 flex-1 items-center gap-1 text-left font-medium" onClick={onEdit}>
            <span className="truncate group-hover:underline">{a.name}</span>
            <span className="text-muted-foreground ml-1 shrink-0 text-xs font-normal">{periodLabel(a)}</span>
            <Pencil className="text-muted-foreground size-3 shrink-0 opacity-0 group-hover:opacity-100" />
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
        <div className="text-muted-foreground flex justify-between pl-7 text-xs">
          <span>
            {row.spends.length} spend{row.spends.length === 1 ? "" : "s"}
          </span>
          <span>{row.bucket === "current" ? `${left} day${left === 1 ? "" : "s"} left` : row.bucket === "upcoming" ? `starts ${formatHuman(a.from)}` : "ended"}</span>
        </div>
        {open && <SpendList spends={row.spends} onEditSpend={onEditSpend} />}
      </CardContent>
    </Card>
  );
}
