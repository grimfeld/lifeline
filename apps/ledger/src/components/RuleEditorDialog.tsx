import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import type { CategorizeRule, RuleMode, Transaction } from "../domain/types";
import { matchRule, normalizePayee } from "../domain/suggest";
import { addRule, deleteRule, updateRule, useCategorizeRules, useCategories, useTransactions } from "../data/repo";

/** Payees the rule as typed would decide, newest first — the preview under the form. */
function payeesHit(transactions: Transaction[], draft: CategorizeRule): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of transactions) {
    if (t.kind !== "expense" && t.kind !== "income") continue;
    const key = normalizePayee(t.payee);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    if (matchRule(t.payee, t.kind, [draft])) out.push(t.payee);
  }
  return out;
}

/**
 * A Categorize rule (ADR 0040): payee text, how it is read, and either the
 * Category it always means or the never that keeps the payee out of
 * auto-categorization altogether. The rule's kind is not asked for — a
 * category rule speaks for its Category's kind, a never rule for both. What
 * the rule would decide in the ledger as it stands is shown while typing,
 * so a rule that is too greedy says so before it is saved.
 */
export function RuleEditorDialog({ open, onOpenChange, rule, initialMatch, initialNever }: { open: boolean; onOpenChange: (open: boolean) => void; rule?: CategorizeRule; initialMatch?: string; initialNever?: boolean }) {
  const categories = useCategories();
  const transactions = useTransactions();
  const rules = useCategorizeRules();
  const [match, setMatch] = useState("");
  const [mode, setMode] = useState<RuleMode>("contains");
  const [categoryId, setCategoryId] = useState("");
  const [never, setNever] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMatch(rule?.match ?? initialMatch ?? "");
    setMode(rule?.mode ?? "contains");
    setCategoryId(rule?.categoryId ?? "");
    setNever(rule?.never ?? initialNever ?? false);
  }, [open, rule, initialMatch, initialNever]);

  /** The draft as the matcher would see it — id "" so it never collides with a stored rule. */
  const draft = useMemo(
    () => ({ id: "", match, mode, never, categoryId, kind: never ? "both" : (categories.find((c) => c.id === categoryId)?.kind ?? "expense") }) as CategorizeRule,
    [match, mode, never, categoryId, categories],
  );
  const hits = useMemo(() => (normalizePayee(match) ? payeesHit(transactions, draft) : []), [transactions, draft, match]);
  /** Rules that already speak for these payees — a warning, never a block: the panel's precedence decides. */
  const shadowed = useMemo(() => {
    if (!normalizePayee(match)) return [];
    const others = rules.filter((r) => r.id !== rule?.id);
    const kinds = draft.kind === "both" ? (["expense", "income"] as const) : ([draft.kind] as const);
    return Array.from(new Set(hits.flatMap((p) => kinds.map((k) => matchRule(p, k, others))).filter((r): r is CategorizeRule => !!r).map((r) => r.match)));
  }, [hits, rules, rule, draft, match]);

  async function submit() {
    setSaving(true);
    try {
      const input = { match, mode, categoryId, never };
      if (rule) {
        await updateRule(rule, input);
        toast.success("Rule updated");
      } else {
        await addRule(input);
        toast.success(never ? `“${match.trim()}” is never auto-categorized` : "Rule added");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!rule) return;
    await deleteRule(rule.id);
    toast.success("Rule deleted");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : never ? "Never auto-categorize" : "New rule"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="rule-match">Payee text</Label>
            <Input id="rule-match" value={match} onChange={(e) => setMatch(e.target.value)} placeholder="Albert Heijn" autoFocus onKeyDown={(e) => e.key === "Enter" && void submit()} />
            <p className="text-muted-foreground text-xs">Casing, digits and punctuation are ignored — “AMAZON EU S.A.R.L. 1234” and “Amazon” are the same text here.</p>
          </div>
          <div className="grid gap-2">
            <Label>Match</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as RuleMode)}>
              <SelectTrigger aria-label="Match">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="contains">Contains — the text anywhere in the bank's payee</SelectItem>
                <SelectItem value="exact">Exact — the whole payee, nothing more</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox className="mt-0.5" checked={never} onCheckedChange={(v) => setNever(v === true)} />
            <span>
              Never auto-categorize
              <span className="text-muted-foreground block text-xs">One payee, many categories (Amazon): matching rows land uncategorized in the inbox and history never guesses for them again.</span>
            </span>
          </label>
          {!never && (
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger aria-label="Category">
                  <SelectValue placeholder="Pick the category this payee always means" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.group ? `${c.group} · ${c.title}` : c.title} · {c.kind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {categoryId && <p className="text-muted-foreground text-xs">The rule applies to {categories.find((c) => c.id === categoryId)?.kind === "income" ? "income" : "expense"} rows — a category's own kind decides, so there is nothing else to set.</p>}
            </div>
          )}
          {normalizePayee(match) !== "" && (
            <div className="text-muted-foreground grid gap-1 rounded-md border px-3 py-2 text-xs">
              <span>
                {hits.length === 0 ? "No payee in the ledger matches this yet — it will still catch future imports." : `Matches ${hits.length} payee${hits.length === 1 ? "" : "s"} in the ledger: `}
                {hits.slice(0, 6).join(" · ")}
                {hits.length > 6 ? ` … and ${hits.length - 6} more` : ""}
              </span>
              {shadowed.length > 0 && <span className="text-amber-600">Some of those already answer to: {shadowed.join(" · ")} — the narrower rule wins, a never rule wins over both.</span>}
            </div>
          )}
        </div>
        <DialogFooter>
          {rule && (
            <Button variant="ghost" className="text-destructive mr-auto" onClick={() => void remove()}>
              Delete
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={saving} onClick={() => void submit()}>
            {rule ? "Save" : "Add rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
