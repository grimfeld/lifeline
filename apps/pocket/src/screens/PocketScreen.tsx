import { useMemo, useState } from "react";
import { Button, Card, CardContent, PhoneDock, cn, toast } from "@lifeline/ui";
import { formatHuman, todayStr } from "@lifeline/core";
import { ChevronDown, ChevronRight, Pencil, Plus, RefreshCw, Wallet } from "lucide-react";
import { faceColor, faceOf, type Allowance, type Bucket, type Spend } from "../domain/types";
import { allowanceRows, renewable, sortRows, canRenew, jarLevel, type AllowanceRow } from "../domain/derive";
import { daysLeft, periodLabel } from "../domain/period";
import { formatCents } from "../domain/money";
import { renewAllowance, useAllowances, useSpends } from "../data/repo";
import { AllowanceEditorDialog } from "../components/AllowanceEditorDialog";
import { SpendDialog } from "../components/SpendDialog";
import { AllowanceSheet } from "../components/AllowanceSheet";
import { Jar } from "../components/Jar";

const BUCKETS: { key: Bucket; title: string; empty: string }[] = [
  { key: "current", title: "Now", empty: "Nothing running today — make an allowance or renew an ended one." },
  { key: "upcoming", title: "Upcoming", empty: "" },
  { key: "past", title: "Past", empty: "" },
];

/**
 * Pocket (ADR 0037): every Allowance in three buckets — running today,
 * starting later, ended — each with what is left. Renewal is a tap, never
 * automatic. What runs today stands as a shelf of jars (CONTEXT: Allowance's
 * face), draining as Spends land: tapping a jar is always a Spend, one tap.
 * The rest are rows with a small jar in the margin; a row opens its
 * Allowance. Opened, an Allowance is a sheet — its Spends, Spend, Edit, Renew.
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
  const [sheetId, setSheetId] = useState<string | undefined>();

  const current = rows.filter((r) => r.bucket === "current");
  const totalLeft = current.reduce((s, r) => s + r.left, 0);
  const totalGranted = current.reduce((s, r) => s + r.allowance.amount, 0);
  const sheetRow = sheetId ? rows.find((r) => r.allowance.id === sheetId) : undefined;

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
      <div className="flex flex-wrap items-center gap-2">
        <Wallet className="size-5" />
        <h1 className="flex-1 text-lg font-semibold">Pocket</h1>
        <PhoneDock row className="justify-end">
          <Button variant="outline" onClick={() => setNewOpen(true)}>
            <Plus /> New allowance
          </Button>
          <Button onClick={() => openSpend()} disabled={rows.length === 0}>
            <Plus /> Spend
          </Button>
        </PhoneDock>
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

      {ended.length > 0 && (
        <div className="bg-muted/50 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <RefreshCw className="text-muted-foreground size-4 shrink-0" />
          <span className="flex-1">
            {ended.length} allowance{ended.length === 1 ? "" : "s"} ended
          </span>
          <Button size="sm" variant="outline" onClick={() => void renewAll()}>
            {ended.length === 1 ? "Renew" : "Renew all"}
          </Button>
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
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {bucketRows.map((row) => (
                  <JarTile key={row.allowance.id} row={row} today={today} onEdit={() => setEditing(row.allowance)} onSpend={() => openSpend(row.allowance.id)} onOpen={() => setSheetId(row.allowance.id)} />
                ))}
              </div>
            )}
            {key !== "current" && !collapsed && bucketRows.map((row) => <AllowanceLine key={row.allowance.id} row={row} renewable={canRenew(row.allowance, allowances)} onEdit={() => setEditing(row.allowance)} onSpend={() => openSpend(row.allowance.id)} onOpen={() => setSheetId(row.allowance.id)} onRenew={() => void renew(row.allowance)} />)}
          </div>
        );
      })}

      <AllowanceSheet
        row={sheetRow}
        onOpenChange={(o) => !o && setSheetId(undefined)}
        renewable={!!sheetRow && sheetRow.bucket === "past" && canRenew(sheetRow.allowance, allowances)}
        onSpend={() => sheetRow && openSpend(sheetRow.allowance.id)}
        onEdit={() => sheetRow && setEditing(sheetRow.allowance)}
        onRenew={() => sheetRow && void renew(sheetRow.allowance)}
        onEditSpend={editSpend}
      />
      <AllowanceEditorDialog open={newOpen} onOpenChange={setNewOpen} />
      <AllowanceEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} allowance={editing} spendCount={editing ? rows.find((r) => r.allowance.id === editing.id)?.spends.length : 0} />
      <SpendDialog open={spendOpen} onOpenChange={setSpendOpen} allowanceId={spendFor} spend={editingSpend} />
    </div>
  );
}

/**
 * A running Allowance as a jar on the shelf. The whole card spends — the "+"
 * on the jar says so — and only two things on it are not a Spend: the pencil
 * (edit) and the chip beneath (open the Allowance).
 */
function JarTile({ row, today, onEdit, onSpend, onOpen }: { row: AllowanceRow; today: string; onEdit: () => void; onSpend: () => void; onOpen: () => void }) {
  const a = row.allowance;
  const over = row.left < 0;
  const left = daysLeft(a, today);
  const n = row.spends.length;
  return (
    <Card className="group/tile relative py-0">
      <button className="hover:bg-accent/30 active:bg-accent/50 absolute inset-0 rounded-xl motion-safe:transition-colors" onClick={onSpend} aria-label={`Spend from ${a.name}`} title="Spend" />
      <PencilButton name={a.name} onEdit={onEdit} className="absolute top-1 right-1 z-10" />
      <CardContent className="pointer-events-none grid justify-items-center gap-1 px-2 pt-4 pb-3 text-center">
        <span className="relative">
          <Jar level={jarLevel(row)} over={over} color={faceColor(a)} className="motion-safe:transition-transform motion-safe:group-hover/tile:scale-105 motion-safe:group-active/tile:scale-95" />
          <span className="absolute inset-x-0 top-[39px] text-2xl leading-none drop-shadow-sm">{faceOf(a)}</span>
          <span className="bg-primary text-primary-foreground ring-card absolute -right-1.5 bottom-0 grid size-5 place-items-center rounded-full ring-2" aria-hidden>
            <Plus className="size-3.5" strokeWidth={3} />
          </span>
        </span>
        <span className={cn("text-xl font-semibold tabular-nums", over && "text-destructive")}>{formatCents(row.left)}</span>
        <span className="w-full truncate text-sm leading-tight font-medium">{a.name}</span>
        <span className="text-muted-foreground text-xs leading-tight">
          {periodLabel(a)}
          <br />
          {left} day{left === 1 ? "" : "s"} left
        </span>
        <button className="bg-card hover:bg-accent active:bg-accent pointer-events-auto relative z-10 mt-1 flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums" onClick={onOpen} aria-label={`Open ${a.name}`}>
          {n} spend{n === 1 ? "" : "s"} · {formatCents(row.spent)}
          <ChevronRight className="text-muted-foreground size-3" />
        </button>
      </CardContent>
    </Card>
  );
}

/** An upcoming or ended Allowance as a row, its jar small in the margin. The row opens the Allowance; the buttons on it do what they say. */
function AllowanceLine({ row, renewable, onEdit, onSpend, onOpen, onRenew }: { row: AllowanceRow; renewable: boolean; onEdit: () => void; onSpend: () => void; onOpen: () => void; onRenew: () => void }) {
  const a = row.allowance;
  const over = row.left < 0;
  const n = row.spends.length;

  return (
    <Card className="relative py-0">
      <button className="hover:bg-accent/30 active:bg-accent/50 absolute inset-0 rounded-xl" onClick={onOpen} aria-label={`Open ${a.name}`} />
      <CardContent className="pointer-events-none grid gap-0.5 px-3 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Jar level={jarLevel(row)} over={over} color={faceColor(a)} size="sm" />
          <span className="w-5 shrink-0 text-center text-base leading-none">{faceOf(a)}</span>
          <span className="min-w-0 flex-1 truncate font-medium">{a.name}</span>
          <span className={cn("shrink-0 font-semibold tabular-nums", over && "text-destructive")}>{formatCents(row.left)}</span>
          <PencilButton name={a.name} onEdit={onEdit} className="pointer-events-auto relative z-10" />
          {row.bucket !== "past" && (
            <Button size="sm" variant="outline" className="pointer-events-auto relative z-10" onClick={onSpend}>
              <Plus /> Spend
            </Button>
          )}
          {row.bucket === "past" && renewable && (
            <Button size="sm" variant="outline" className="pointer-events-auto relative z-10" onClick={onRenew}>
              <RefreshCw /> Renew
            </Button>
          )}
        </div>
        <div className="text-muted-foreground flex flex-wrap justify-between gap-x-3 pl-12 text-xs">
          <span className="tabular-nums">
            {periodLabel(a)} · {n} spend{n === 1 ? "" : "s"} · {formatCents(row.spent)} / {formatCents(a.amount)}
          </span>
          <span>{row.bucket === "upcoming" ? `starts ${formatHuman(a.from)}` : "ended"}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function PencilButton({ name, onEdit, className }: { name: string; onEdit: () => void; className?: string }) {
  return (
    <Button size="icon" variant="ghost" className={cn("text-muted-foreground hover:text-foreground size-8", className)} onClick={onEdit} aria-label={`Edit ${name}`} title="Edit">
      <Pencil className="size-3.5" />
    </Button>
  );
}
