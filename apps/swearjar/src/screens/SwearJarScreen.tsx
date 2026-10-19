import { useMemo, useState } from "react";
import { Button, Card, CardContent, PhoneDock, cn } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import { Archive, ChevronDown, ChevronLeft, ChevronRight, Pencil, PiggyBank, Plus } from "lucide-react";
import { faceColor, faceOf, type Fine, type Offence } from "../domain/types";
import { activeOffences, dayKeyOf, finesIn, jarTotal, monthKeyOf, monthLabel, shiftMonth, tallyByOffence, timeOf, type MonthKey } from "../domain/derive";
import { formatCents } from "../domain/money";
import { useFines, useOffences } from "../data/repo";
import { OffenceButton } from "../components/OffenceButton";
import { OffenceEditorDialog } from "../components/OffenceEditorDialog";
import { FineDialog } from "../components/FineDialog";

/**
 * The Swear Jar (ADR 0083): one calendar month's jar at a time — its total,
 * the Offences as one-tap buttons, the month per Offence, then its Fines.
 * Nothing resets; the arrows walk back through months already closed.
 */
export function SwearJarScreen() {
  const offences = useOffences();
  const fines = useFines();
  const thisMonth = monthKeyOf(new Date().toISOString());
  const [month, setMonth] = useState<MonthKey>(thisMonth);

  const active = useMemo(() => activeOffences(offences), [offences]);
  const archived = useMemo(() => offences.filter((o) => o.archived).sort((a, b) => a.name.localeCompare(b.name)), [offences]);
  const monthFines = useMemo(() => finesIn(fines, month), [fines, month]);
  const tally = useMemo(() => tallyByOffence(offences, monthFines), [offences, monthFines]);
  const total = jarTotal(monthFines);
  const byId = useMemo(() => new Map(offences.map((o) => [o.id, o])), [offences]);
  const fineCount = (id: string) => fines.filter((f) => f.offenceId === id).length;

  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<Offence | undefined>();
  const [fineOpen, setFineOpen] = useState(false);
  const [fineFor, setFineFor] = useState<string | undefined>();
  const [editingFine, setEditingFine] = useState<Fine | undefined>();
  const [showArchived, setShowArchived] = useState(false);

  function openFine(offenceId?: string) {
    setEditingFine(undefined);
    setFineFor(offenceId);
    setFineOpen(true);
  }

  function editFine(f: Fine) {
    setFineFor(undefined);
    setEditingFine(f);
    setFineOpen(true);
  }

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <PiggyBank className="size-5" />
        <h1 className="flex-1 text-lg font-semibold">Swear Jar</h1>
        <PhoneDock>
          <Button variant="outline" onClick={() => setNewOpen(true)}>
            <Plus /> New offence
          </Button>
          <Button onClick={() => openFine()} disabled={active.length === 0}>
            <Plus /> Fine…
          </Button>
        </PhoneDock>
      </div>

      <Card className="py-0">
        <CardContent className="grid justify-items-center gap-1 px-3 py-5">
          <div className="flex w-full items-center justify-between">
            <Button size="icon" variant="ghost" onClick={() => setMonth((m) => shiftMonth(m, -1))} aria-label="Previous month">
              <ChevronLeft />
            </Button>
            <button className="text-muted-foreground text-sm font-medium" onClick={() => setMonth(thisMonth)} disabled={month === thisMonth} title="Back to this month">
              {monthLabel(month)}
            </button>
            <Button size="icon" variant="ghost" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={month >= thisMonth} aria-label="Next month">
              <ChevronRight />
            </Button>
          </div>
          <span className={cn("text-4xl font-semibold tabular-nums", total > 0 && "text-destructive")}>{formatCents(total)}</span>
          <span className="text-muted-foreground text-xs">
            {monthFines.length} fine{monthFines.length === 1 ? "" : "s"}
            {month === thisMonth ? " this month" : ""}
          </span>
        </CardContent>
      </Card>

      <section className="grid gap-1.5">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Offences</h2>
        {active.length === 0 ? (
          <p className="text-muted-foreground text-sm">No offences yet — name the first thing you want to pay for.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {active.map((o) => (
              <div key={o.id} className="flex items-center gap-1">
                <div className="grid min-w-0 flex-1">
                  <OffenceButton offence={o} onDetails={() => openFine(o.id)} />
                </div>
                <Button size="icon" variant="ghost" className="size-8 shrink-0" onClick={() => setEditing(o)} aria-label={`Edit ${o.name}`} title="Edit">
                  <Pencil className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <p className="text-muted-foreground text-xs">Tap to fine yourself now; hold for another time or a note.</p>
        {archived.length > 0 && (
          <div className="grid gap-1">
            <button className="text-muted-foreground flex items-center gap-1 text-left text-xs" onClick={() => setShowArchived((v) => !v)} aria-expanded={showArchived}>
              {showArchived ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
              <Archive className="size-3" /> {archived.length} archived
            </button>
            {showArchived &&
              archived.map((o) => (
                <button key={o.id} className="hover:bg-accent/50 flex items-center gap-2 rounded-sm px-2 py-1 text-left text-sm opacity-70" onClick={() => setEditing(o)}>
                  <span className="w-5 text-center">{faceOf(o)}</span>
                  <span className="min-w-0 flex-1 truncate">{o.name}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">{formatCents(o.price)}</span>
                </button>
              ))}
          </div>
        )}
      </section>

      {tally.length > 0 && (
        <section className="grid gap-1.5">
          <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">By offence</h2>
          <Card className="py-0">
            <CardContent className="grid gap-0.5 px-2 py-2">
              {tally.map((r) => (
                <div key={r.offenceId} className="flex items-center gap-2 px-1 py-0.5 text-sm">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full text-[11px] leading-none text-white" style={{ background: r.offence ? faceColor(r.offence) : "var(--muted-foreground)" }}>
                    {r.offence ? faceOf(r.offence) : "?"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{r.offence?.name ?? "A deleted offence"}</span>
                  <span className="text-muted-foreground text-xs tabular-nums">× {r.count}</span>
                  <span className="w-20 text-right font-medium tabular-nums">{formatCents(r.total)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      <section className="grid gap-1.5">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">Fines</h2>
        {monthFines.length === 0 ? (
          <p className="text-muted-foreground text-sm">{month === thisMonth ? "The jar is empty this month. Keep it that way." : "Nothing in the jar that month."}</p>
        ) : (
          <Card className="py-0">
            <CardContent className="grid gap-0.5 px-2 py-2">
              {monthFines.map((f) => {
                const o = byId.get(f.offenceId);
                return (
                  <button key={f.id} className="hover:bg-accent/50 flex items-center gap-3 rounded-sm px-1 py-1 text-left text-sm" onClick={() => editFine(f)}>
                    <span className="text-muted-foreground w-32 shrink-0 text-xs">
                      {formatHuman(dayKeyOf(f.occurredAt))} · {timeOf(f.occurredAt)}
                    </span>
                    <span className="w-5 shrink-0 text-center">{o ? faceOf(o) : "?"}</span>
                    <span className="min-w-0 flex-1 truncate">
                      {o?.name ?? "A deleted offence"}
                      {f.note && <span className="text-muted-foreground ml-2 text-xs">{f.note}</span>}
                    </span>
                    <span className="tabular-nums">{formatCents(f.amount)}</span>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        )}
      </section>

      <OffenceEditorDialog open={newOpen} onOpenChange={setNewOpen} />
      <OffenceEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} offence={editing} fineCount={editing ? fineCount(editing.id) : 0} />
      <FineDialog open={fineOpen} onOpenChange={setFineOpen} offenceId={fineFor} fine={editingFine} />
    </div>
  );
}
