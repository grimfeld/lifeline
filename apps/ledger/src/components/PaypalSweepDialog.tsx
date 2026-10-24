import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import type { Transaction } from "../domain/types";
import { looksLikePaypal, matchPaypal, type PaypalCandidate, type PaypalMatch } from "../domain/paypal";
import { formatCents } from "../domain/money";
import { resolvePaypalPayee, useTransactions } from "../data/repo";
import { PaypalFileInput, usePaypalFile } from "./PaypalFileInput";

/**
 * The later half of PayPal payee resolution (`domain/paypal.ts`): the same
 * activity file run over transactions already in the ledger, so history
 * imported before any of this gets its real merchants too. Idempotent — a
 * row that carries a `paypalId` has been through here and is left alone,
 * which is also how a hand-corrected payee survives a second sweep.
 */
export function PaypalSweepDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const transactions = useTransactions();
  const paypal = usePaypalFile();
  /** Transaction id → chosen PayPal entry id; "" = leave this one as the bank wrote it. */
  const [picked, setPicked] = useState<Map<string, string>>(new Map());
  /** null = untouched → the default ticks apply. */
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const [applying, setApplying] = useState(false);

  // A different file is a different set of answers: ticks and picks start over.
  useEffect(() => {
    setPicked(new Map());
    setTicked(null);
  }, [paypal.index]);

  /** Everything still wearing the bank's PayPal name, oldest first so a long history reads in order. */
  const pending = useMemo(
    () =>
      transactions
        .filter((t) => (t.kind === "expense" || t.kind === "income") && !t.paypalId && looksLikePaypal(t.payee))
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date)),
    [transactions],
  );

  const matches = useMemo(() => {
    const out = new Map<string, PaypalMatch>();
    if (!paypal.index) return out;
    for (const t of pending) {
      const m = matchPaypal({ date: t.date, amount: t.amount, text: `${t.payee} ${t.note}` }, paypal.index);
      if (m.status !== "none") out.set(t.id, m);
    }
    return out;
  }, [pending, paypal.index]);

  const matched = useMemo(() => pending.filter((t) => matches.has(t.id)), [pending, matches]);

  function resolutionOf(t: Transaction): PaypalCandidate | null {
    const m = matches.get(t.id);
    if (!m) return null;
    const choice = picked.get(t.id);
    if (choice !== undefined) return m.candidates.find((c) => c.entry.id === choice) ?? null;
    return m.pick;
  }

  /** Default ticks: everything the file answered on its own. An ambiguity is only ticked once a merchant is picked. */
  const defaultTicks = useMemo(() => new Set(matched.filter((t) => matches.get(t.id)?.pick).map((t) => t.id)), [matched, matches]);
  const effectiveTicks = ticked ?? defaultTicks;

  function toggle(id: string) {
    const next = new Set(effectiveTicks);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicked(next);
  }

  function pick(t: Transaction, entryId: string) {
    setPicked(new Map(picked).set(t.id, entryId));
    const next = new Set(effectiveTicks);
    if (entryId) next.add(t.id);
    else next.delete(t.id);
    setTicked(next);
  }

  async function apply() {
    const chosen = matched.filter((t) => effectiveTicks.has(t.id)).map((t) => ({ t, resolved: resolutionOf(t) }));
    const real = chosen.filter((c): c is { t: Transaction; resolved: PaypalCandidate } => c.resolved !== null);
    if (real.length === 0) return void toast.error("Nothing ticked");
    setApplying(true);
    try {
      for (const { t, resolved } of real) await resolvePaypalPayee(t, resolved.payee, resolved.entry.id);
      toast.success(`${real.length} payee${real.length === 1 ? "" : "s"} named — Auto-categorize can sort them now`);
      onOpenChange(false);
      setPicked(new Map());
      setTicked(null);
      paypal.clear();
    } finally {
      setApplying(false);
    }
  }

  const ambiguous = matched.filter((t) => matches.get(t.id)?.status === "ambiguous" && !picked.get(t.id)).length;
  const unmatched = pending.length - matched.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Name the PayPal payees</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <p className="text-muted-foreground text-sm">
            {pending.length} transaction{pending.length === 1 ? "" : "s"} still carry the bank's PayPal name. Hand over a PayPal activity file covering those months and each one takes the merchant's own name — the bank's string is kept underneath.
          </p>
          <PaypalFileInput file={paypal} />
          {paypal.index && (
            <>
              <div className="text-muted-foreground text-xs">
                {matched.length} matched
                {ambiguous > 0 && <span className="text-amber-600"> · {ambiguous} need a merchant picked</span>}
                {unmatched > 0 && <span> · {unmatched} unmatched — paid from your PayPal balance, or outside this file's months</span>}
              </div>
              <div className="max-h-96 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <tbody>
                    {matched.map((t) => (
                      <tr key={t.id}>
                        <td className="w-8 px-2 py-1">
                          <Checkbox checked={effectiveTicks.has(t.id)} disabled={!resolutionOf(t)} onCheckedChange={() => toggle(t.id)} />
                        </td>
                        <td className="text-muted-foreground w-24 px-2 py-1 text-xs whitespace-nowrap">{formatHuman(t.date)}</td>
                        <td className="w-24 px-2 py-1 text-right whitespace-nowrap tabular-nums">
                          {t.kind === "expense" ? "−" : "+"}
                          {formatCents(t.amount)}
                        </td>
                        <td className="text-muted-foreground max-w-40 truncate px-2 py-1 text-xs">{t.payee}</td>
                        <td className="px-2 py-1">
                          <Select value={resolutionOf(t)?.entry.id ?? "none"} onValueChange={(v) => pick(t, v === "none" ? "" : v)}>
              <SelectTrigger aria-label="Merchant" size="sm" className="w-48 text-xs">
                              <SelectValue placeholder="which merchant?" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— leave it alone</SelectItem>
                              {matches.get(t.id)!.candidates.map((c) => (
                                <SelectItem key={c.entry.id} value={c.entry.id}>
                                  {c.payee}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="text-muted-foreground w-24 px-2 py-1 text-xs">{matches.get(t.id)?.status === "ambiguous" && !picked.get(t.id) ? "pick one" : matches.get(t.id)?.status === "exact" ? "reference" : ""}</td>
                      </tr>
                    ))}
                    {matched.length === 0 && (
                      <tr>
                        <td className="text-muted-foreground px-4 py-6 text-center text-sm">Nothing in this file matches those transactions — check it covers the same months.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {paypal.index && (
            <Button disabled={applying || effectiveTicks.size === 0} onClick={() => void apply()}>
              Name {effectiveTicks.size} payee{effectiveTicks.size === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
