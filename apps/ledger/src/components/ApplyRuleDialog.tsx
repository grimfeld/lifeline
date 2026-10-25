import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import type { CategorizeRule, LedgerCategory } from "../domain/types";
import { ruleHistoryChanges } from "../domain/suggest";
import { applyRuleChanges, undoRuleChanges } from "../domain/applyChanges";
import { formatCents } from "../domain/money";
import { categorizeTransaction, useAccounts, useCategories, useCategorizeRules, useTransactions } from "../data/repo";

function categoryName(categories: LedgerCategory[], id: string): string {
  if (!id) return "—";
  const c = categories.find((x) => x.id === id);
  return c ? c.title : "Unknown category";
}

/**
 * Apply to history: every Transaction this Categorize rule decides whose
 * Category differs from the rule's, listed before anything is written.
 * Nothing changes until the user confirms the ticked rows.
 */
export function ApplyRuleDialog({ rule, onOpenChange }: { rule: CategorizeRule | undefined; onOpenChange: (open: boolean) => void }) {
  const transactions = useTransactions();
  const rules = useCategorizeRules();
  const categories = useCategories();
  const accounts = useAccounts();
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  const changes = useMemo(() => (rule ? ruleHistoryChanges(transactions, rules, rule) : []), [transactions, rules, rule]);
  // A fresh rule (or fresh set of rows) starts all ticked.
  const key = changes.map((c) => c.transaction.id).join(",");
  useEffect(() => {
    setTicked(new Set(changes.map((c) => c.transaction.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, rule?.id]);

  const chosen = changes.filter((c) => ticked.has(c.transaction.id));
  const months = new Set(chosen.map((c) => c.transaction.date.slice(0, 7))).size;
  const allTicked = changes.length > 0 && chosen.length === changes.length;

  function toggle(id: string) {
    const next = new Set(ticked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setTicked(next);
  }

  async function apply() {
    setApplying(true);
    try {
      const done = await applyRuleChanges(chosen, categorizeTransaction);
      toast.success(`Recategorized ${done.length} transaction${done.length === 1 ? "" : "s"}`, {
        action: {
          label: "Undo",
          onClick: () =>
            void undoRuleChanges(done, categorizeTransaction).then(
              () => toast.success(`Restored ${done.length} transaction${done.length === 1 ? "" : "s"}`),
              (e: unknown) => toast.error((e as Error).message),
            ),
        },
      });
      onOpenChange(false);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Dialog open={!!rule} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-words">Apply “{rule?.match}” to history</DialogTitle>
          <DialogDescription>
            {rule ? `→ ${categoryName(categories, rule.categoryId)} · ` : ""}Changes spending in {months} past month{months === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        {changes.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing to change — every transaction this rule decides is already in its Category.</p>
        ) : (
          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allTicked} onCheckedChange={() => setTicked(allTicked ? new Set() : new Set(changes.map((c) => c.transaction.id)))} aria-label="Select all" />
              Select all ({chosen.length} of {changes.length})
            </label>
            <ul className="max-h-96 divide-y overflow-y-auto rounded-md border">
              {changes.map((c) => {
                const t = c.transaction;
                return (
                  <li key={t.id} className="flex items-start gap-2 px-2 py-1.5 text-sm">
                    <Checkbox className="mt-0.5" checked={ticked.has(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Recategorize ${t.payee}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 break-words">{t.payee}</span>
                        <span className="whitespace-nowrap tabular-nums">
                          {t.kind === "expense" ? "−" : "+"}
                          {formatCents(t.amount)}
                        </span>
                      </div>
                      <div className="text-muted-foreground text-xs break-words">
                        {formatHuman(t.date)} · {accounts.find((a) => a.id === t.accountId)?.title ?? "Account"} · {categoryName(categories, c.from)} → {categoryName(categories, c.to)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <DialogFooter className="max-md:flex-col">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={chosen.length === 0 || applying} onClick={() => void apply()}>
            Recategorize {chosen.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
