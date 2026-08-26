import { useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import type { ImportMapping, LedgerAccount } from "../domain/types";
import { applyMapping, flagDuplicates, parseCsv, type ImportRow } from "../domain/csv";
import { isOfx, parseOfx } from "../domain/ofx";
import { formatCents } from "../domain/money";
import { importRows, saveImportMapping, useTransactions } from "../data/repo";

const DEFAULT_MAPPING: ImportMapping = { dateCol: 0, amountCol: 1, payeeCol: 2, noteCol: null, idCol: null, dateFormat: "DMY", decimal: "comma", invert: false, skipHeader: true };

/**
 * Bank-file import (ADR 0033): pick file → for CSV a mapping step (saved on
 * the Account after the first run — later imports are pick-file-and-go),
 * for OFX/QFX nothing — the format is self-describing and its FITID makes
 * dedupe exact → preview with duplicates flagged and unticked → post.
 * Imported rows may land uncategorized: the inbox is loud in Register and
 * Budget, never hidden.
 */
export function ImportDialog({ open, onOpenChange, account }: { open: boolean; onOpenChange: (open: boolean) => void; account: LedgerAccount }) {
  const transactions = useTransactions();
  const [rows, setRows] = useState<string[][] | null>(null);
  /** OFX path: parsed rows straight from the file — no mapping state at all. */
  const [ofxRows, setOfxRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState<ImportMapping>(account.importMapping ?? DEFAULT_MAPPING);
  /** null = untouched → default ticks apply (readable, non-duplicate rows). */
  const [ticked, setTicked] = useState<Set<number> | null>(null);
  const [posting, setPosting] = useState(false);

  const preview: ImportRow[] = useMemo(() => {
    const raw = ofxRows ?? (rows ? applyMapping(rows, mapping) : null);
    if (!raw) return [];
    return flagDuplicates(raw, transactions, account.id);
  }, [rows, ofxRows, mapping, transactions, account.id]);

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
    });
  }

  function reset() {
    setRows(null);
    setOfxRows(null);
    setTicked(null);
  }

  function toggle(index: number) {
    const next = new Set(effectiveTicks);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setTicked(next);
  }

  async function post() {
    const chosen = preview.filter((r) => effectiveTicks.has(r.index));
    if (chosen.length === 0) return void toast.error("Nothing ticked");
    setPosting(true);
    try {
      const n = await importRows(chosen, account.id);
      // The mapping is a CSV concern; OFX is self-describing.
      if (rows) await saveImportMapping(account.id, mapping);
      toast.success(`Imported ${n} transaction${n === 1 ? "" : "s"} — categorize them in the Register`);
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
      <DialogContent className="sm:max-w-3xl">
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
              negative = expense, positive = income; rows land uncategorized.
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
                      <td className="max-w-48 truncate px-2 py-1">{r.payee}</td>
                      <td className="text-muted-foreground max-w-40 truncate px-2 py-1 text-xs">{r.invalid ? "unreadable" : r.duplicateOf ? "already in the ledger?" : ""}</td>
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
