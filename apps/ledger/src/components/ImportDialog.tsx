import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import type { ImportMapping, LedgerAccount } from "../domain/types";
import { applyMapping, flagDuplicates, parseCsv, type ImportRow } from "../domain/csv";
import { isOfx, parseOfx } from "../domain/ofx";
import { matchRule, payeeCategoryIndex, suggestCategory, type Suggestion } from "../domain/suggest";
import { looksLikePaypal, matchPaypal, type PaypalCandidate, type PaypalMatch } from "../domain/paypal";
import { PaypalFileInput, usePaypalFile } from "./PaypalFileInput";
import { formatCents } from "../domain/money";
import { importRows, saveImportMapping, useCategories, useCategorizeRules, useTransactions } from "../data/repo";

const DEFAULT_MAPPING: ImportMapping = { dateCol: 0, amountCol: 1, payeeCol: 2, noteCol: null, idCol: null, dateFormat: "DMY", decimal: "comma", invert: false, skipHeader: true };

/**
 * Bank-file import (ADR 0033): pick file → for CSV a mapping step (saved on
 * the Account after the first run — later imports are pick-file-and-go),
 * for OFX/QFX nothing — the format is self-describing and its FITID makes
 * dedupe exact → preview with duplicates flagged and unticked → post.
 * A PayPal activity file may be handed over alongside: rows the bank filed
 * under "PAYPAL" then show the merchant PayPal knows, and the category
 * suggestion runs on that real name instead of on "PAYPAL" (domain/paypal.ts).
 * Category suggestions obey the Categorize rules (ADR 0040): a rule of yours
 * answers before history does, and a never rule leaves the row blank on
 * purpose. Imported rows may land uncategorized: the inbox is loud in
 * Register and Budget, never hidden.
 */
export function ImportDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (open: boolean) => void; account: LedgerAccount }) {
  const transactions = useTransactions();
  const categories = useCategories();
  const rules = useCategorizeRules();
  const [rows, setRows] = useState<string[][] | null>(null);
  /** OFX path: parsed rows straight from the file — no mapping state at all. */
  const [ofxRows, setOfxRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ImportMapping>(account.importMapping ?? DEFAULT_MAPPING);
  /** null = untouched → default ticks apply (readable, non-duplicate rows). */
  const [ticked, setTicked] = useState<Set<number> | null>(null);
  /** Hand-picked categories per row index; unset rows fall back to the rule or history-derived suggestion. */
  const [pickedCategories, setPickedCategories] = useState<Map<number, string>>(new Map());
  /** The optional PayPal activity file, and the merchant picked per row (entry id; "" = keep the bank's own string). */
  const paypal = usePaypalFile();
  const [pickedPayees, setPickedPayees] = useState<Map<number, string>>(new Map());
  const [posting, setPosting] = useState(false);

  // A different PayPal file is a different set of answers: per-row merchant picks start over.
  useEffect(() => setPickedPayees(new Map()), [paypal.index]);

  const preview: ImportRow[] = useMemo(() => {
    const raw = ofxRows ?? (rows ? applyMapping(rows, mapping) : null);
    if (!raw) return [];
    return flagDuplicates(raw, transactions, account.id);
  }, [rows, ofxRows, mapping, transactions, account.id]);

  /** How many rows the bank filed under PayPal — nothing is asked for unless there are some. */
  const paypalRows = useMemo(() => preview.filter((r) => !r.invalid && looksLikePaypal(r.payee)).length, [preview]);

  /**
   * PayPal rows matched against the activity file — keyed by row index, only
   * for rows the bank filed under PayPal, only where the file has an answer.
   */
  const paypalMatches = useMemo(() => {
    const out = new Map<number, PaypalMatch>();
    if (!paypal.index) return out;
    for (const r of preview) {
      if (r.invalid || r.date === null || r.amount === null || !looksLikePaypal(r.payee)) continue;
      const m = matchPaypal({ date: r.date, amount: r.amount, text: `${r.payee} ${r.note}` }, paypal.index);
      if (m.status !== "none") out.set(r.index, m);
    }
    return out;
  }, [preview, paypal.index]);

  /** The merchant this row will be posted under: the hand pick, else the match's own, else nothing. */
  function resolutionOf(r: ImportRow): PaypalCandidate | null {
    const m = paypalMatches.get(r.index);
    if (!m) return null;
    const picked = pickedPayees.get(r.index);
    if (picked !== undefined) return m.candidates.find((c) => c.entry.id === picked) ?? null;
    return m.pick;
  }

  const payeeOfRow = (r: ImportRow) => resolutionOf(r)?.payee || r.payee;

  /** Suggested category per row ("smart" without AI): a hand-made rule if one speaks, else the last-used category of the matching payee. */
  const catIndex = useMemo(() => payeeCategoryIndex(transactions), [transactions]);
  const { suggestions, vetoed } = useMemo(() => {
    const out = new Map<number, Suggestion>();
    const never = new Set<number>();
    for (const r of preview) {
      if (r.invalid || r.amount === null) continue;
      // The resolved merchant, not "PAYPAL": one PayPal payee would otherwise
      // hand the same category to everything PayPal ever collected.
      const payee = payeeOfRow(r);
      if (!payee) continue;
      const kind = r.amount < 0 ? "expense" : "income";
      if (matchRule(payee, kind, rules)?.never) {
        never.add(r.index);
        continue;
      }
      const s = suggestCategory(payee, kind, catIndex, rules);
      if (s) out.set(r.index, s);
    }
    return { suggestions: out, vetoed: never };
  }, [preview, catIndex, rules, paypalMatches, pickedPayees]);

  const categoryOf = (r: ImportRow) => pickedCategories.get(r.index) ?? suggestions.get(r.index)?.categoryId ?? "";

  // Default ticks: everything readable and not a probable duplicate.
  const defaultTicks = useMemo(() => new Set(preview.filter((r) => !r.invalid && !r.duplicateOf).map((r) => r.index)), [preview]);
  const loaded = rows !== null || ofxRows !== null;
  const effectiveTicks = loaded ? (ticked ?? defaultTicks) : new Set<number>();

  function loadFile(file: File) {
    void file.text().then((text) => {
      if (isOfx(text)) {
        setOfxRows(parseOfx(text));
        setRows(null);
      } else {
        setRows(parseCsv(text));
        setOfxRows(null);
      }
      setFileName(file.name);
      setTicked(null);
      setPickedCategories(new Map());
      setPickedPayees(new Map());
    });
  }

  function reset() {
    setRows(null);
    setOfxRows(null);
    setTicked(null);
    setPickedCategories(new Map());
    setPickedPayees(new Map());
  }

  function toggle(index: number) {
    const next = new Set(effectiveTicks);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setTicked(next);
  }

  async function post() {
    const chosen = preview.filter((r) => effectiveTicks.has(r.index)).map((r) => {
      const resolved = resolutionOf(r);
      // The bank's own string is kept, never overwritten — the swap stays readable and undoable.
      return { ...r, categoryId: categoryOf(r), payee: resolved?.payee ?? r.payee, paypalId: resolved?.entry.id ?? "", bankPayee: resolved ? r.payee : "" };
    });
    if (chosen.length === 0) return void toast.error("Nothing ticked");
    setPosting(true);
    try {
      const n = await importRows(chosen, account.id);
      // The mapping is a CSV concern; OFX is self-describing.
      if (rows) await saveImportMapping(account.id, mapping);
      const bare = chosen.filter((r) => !r.categoryId).length;
      const named = chosen.filter((r) => r.paypalId).length;
      const paypalNote = named > 0 ? ` · ${named} PayPal payee${named === 1 ? "" : "s"} named` : "";
      toast.success((bare > 0 ? `Imported ${n} — ${bare} uncategorized, clear them in the Register` : `Imported ${n}, all categorized`) + paypalNote);
      onOpenChange(false);
      reset();
    } finally {
      setPosting(false);
    }
  }

  const cols = rows?.[0]?.length ?? 0;
  const colPick = (value: number | null, onChange: (v: number | null) => void, allowNone: boolean) => (
    <Select value={value === null ? "none" : String(value)} onValueChange={(v) => onChange(v === "none" ? null : Number(v))}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">—</SelectItem>}
        {Array.from({ length: cols }, (_, i) => (
          <SelectItem key={i} value={String(i)}>
            Column {i + 1}
            {rows?.[0]?.[i] ? ` (${rows[0][i].slice(0, 16)})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const dupCount = preview.filter((r) => r.duplicateOf).length;
  const badCount = preview.filter((r) => r.invalid).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import into {account.title}</DialogTitle>
        </DialogHeader>
        {!loaded ? (
          <div className="grid gap-3">
            <p className="text-muted-foreground text-sm">A CSV or OFX file you export from the bank and hand over — Lifeline never fetches. OFX needs no mapping and its row ids make dedupe exact.</p>
            <Input type="file" accept=".csv,.ofx,.qfx,text/csv" onChange={(e) => e.target.files?.[0] && loadFile(e.target.files[0])} />
          </div>
        ) : (
          <div className="grid gap-4">
            <div className="text-muted-foreground text-sm">
              {fileName}
              {ofxRows && <span className="ml-2 rounded-sm border px-1.5 py-0.5 text-xs">OFX</span>}
            </div>
            {paypalRows > 0 && (
              <div className="grid gap-1 rounded-md border px-3 py-2">
                <Label className="text-xs">
                  {paypalRows} row{paypalRows === 1 ? "" : "s"} the bank filed under PayPal
                  {paypal.index ? ` · ${paypalMatches.size} matched` : ""}
                </Label>
                <PaypalFileInput file={paypal} />
              </div>
            )}
            {rows && (
              <>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              <div className="grid gap-1">
                <Label>Date</Label>
                {colPick(mapping.dateCol, (v) => setMapping({ ...mapping, dateCol: v ?? 0 }), false)}
              </div>
              <div className="grid gap-1">
                <Label>Amount</Label>
                {colPick(mapping.amountCol, (v) => setMapping({ ...mapping, amountCol: v ?? 1 }), false)}
              </div>
              <div className="grid gap-1">
                <Label>Payee</Label>
                {colPick(mapping.payeeCol, (v) => setMapping({ ...mapping, payeeCol: v }), true)}
              </div>
              <div className="grid gap-1">
                <Label>Note</Label>
                {colPick(mapping.noteCol, (v) => setMapping({ ...mapping, noteCol: v }), true)}
              </div>
              <div className="grid gap-1">
                <Label>Row id</Label>
                {colPick(mapping.idCol, (v) => setMapping({ ...mapping, idCol: v }), true)}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div className="grid gap-1">
                <Label>Date format</Label>
                <Select value={mapping.dateFormat} onValueChange={(v) => setMapping({ ...mapping, dateFormat: v as ImportMapping["dateFormat"] })}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DMY">Day-Month-Year</SelectItem>
                    <SelectItem value="YMD">Year-Month-Day</SelectItem>
                    <SelectItem value="MDY">Month-Day-Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox checked={mapping.skipHeader} onCheckedChange={(v) => setMapping({ ...mapping, skipHeader: v === true })} />
                First row is headers
              </label>
              <label className="flex items-center gap-2 pb-2 text-sm">
                <Checkbox checked={mapping.invert} onCheckedChange={(v) => setMapping({ ...mapping, invert: v === true })} />
                Flip signs (bank writes spending as positive)
              </label>
            </div>
              </>
            )}
            <div className="text-muted-foreground text-xs">
              {preview.length} rows · {dupCount > 0 && <span className="text-amber-600">{dupCount} probable duplicates unticked · </span>}
              {badCount > 0 && <span className="text-destructive">{badCount} unreadable · </span>}
              negative = expense, positive = income; categories marked <span className="text-foreground">auto</span> come from how you categorized the payee before, <span className="text-foreground">rule</span> from a Categorize rule of yours, and <span className="text-foreground">never</span> is a payee you told the ledger not to guess — adjust any, the rest land uncategorized.
              {paypalMatches.size > 0 && <> Rows marked <span className="text-foreground">paypal</span> take their payee from the activity file; where two merchants fit the same amount and day, pick one.</>}
            </div>
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <table className="w-full text-sm">
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.index} className={r.invalid ? "text-destructive/70" : r.duplicateOf ? "text-muted-foreground" : ""}>
                      <td className="w-8 px-2 py-1">
                        <Checkbox disabled={r.invalid} checked={effectiveTicks.has(r.index)} onCheckedChange={() => toggle(r.index)} />
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap tabular-nums">{r.date ?? "?"}</td>
                      <td className="px-2 py-1 text-right whitespace-nowrap tabular-nums">{r.amount === null ? "?" : formatCents(r.amount)}</td>
                      <td className="max-w-52 px-2 py-1">
                        {paypalMatches.has(r.index) ? (
                          <div className="grid gap-0.5">
                            <Select value={resolutionOf(r)?.entry.id ?? "none"} onValueChange={(v) => setPickedPayees(new Map(pickedPayees).set(r.index, v === "none" ? "" : v))}>
                              <SelectTrigger size="sm" className="h-7 w-44 text-xs">
                                <SelectValue placeholder="which merchant?" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— keep the bank's name</SelectItem>
                                {paypalMatches.get(r.index)!.candidates.map((c) => (
                                  <SelectItem key={c.entry.id} value={c.entry.id}>
                                    {c.payee}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <span className="text-muted-foreground truncate text-[11px]">{r.payee}</span>
                          </div>
                        ) : (
                          <span className="block truncate">{r.payee}</span>
                        )}
                      </td>
                      <td className="px-2 py-1">
                        {!r.invalid && r.amount !== null && (
                          <Select value={categoryOf(r) || "none"} onValueChange={(v) => setPickedCategories(new Map(pickedCategories).set(r.index, v === "none" ? "" : v))}>
                            <SelectTrigger size="sm" className="h-7 w-40 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">— uncategorized</SelectItem>
                              {categories
                                .filter((c) => c.kind === (r.amount! < 0 ? "expense" : "income"))
                                .map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.group ? `${c.group} · ${c.title}` : c.title}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      <td className="text-muted-foreground max-w-40 truncate px-2 py-1 text-xs">
                        {r.invalid
                          ? "unreadable"
                          : r.duplicateOf
                            ? "already in the ledger?"
                            : [
                                paypalMatches.get(r.index)?.status === "ambiguous" && !pickedPayees.has(r.index) ? "pick a merchant" : paypalMatches.has(r.index) ? "paypal" : "",
                                vetoed.has(r.index) ? "never" : suggestions.has(r.index) && !pickedCategories.has(r.index) ? (suggestions.get(r.index)!.confidence === "rule" ? "rule" : "auto") : "",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <DialogFooter>
          {loaded && (
            <Button variant="outline" onClick={reset}>
              Other file
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {loaded && (
            <Button disabled={posting} onClick={() => void post()}>
              Import {effectiveTicks.size} rows
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
