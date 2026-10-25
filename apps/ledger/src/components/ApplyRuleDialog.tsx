import { useMemo, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, toast } from "@lifeline/ui";
import { formatHuman } from "@lifeline/core";
import type { CategorizeRule, LedgerCategory } from "../domain/types";
import { ruleHistoryChanges, type RuleChange } from "../domain/suggest";
import { applyRuleChanges, undoRuleChanges, WriteStoppedError } from "../domain/applyChanges";
import { plural } from "../domain/plural";
import { categoryLabelById } from "./reportChrome";
import { formatCents } from "../domain/money";
import { categorizeTransaction, useAccounts, useCategories, useCategorizeRules, useTransactions } from "../data/repo";

/** A Category as the preview names it; "—" for uncategorized. */
const categoryName = (categories: LedgerCategory[], id: string) => (id ? categoryLabelById(categories, id) : "—");

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
  // Rows start ticked: the user's exceptions are what is kept, so fresh rows need no reset.
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [writing, setWriting] = useState(false);

  const changes = useMemo(() => (rule ? ruleHistoryChanges(transactions, rules, rule) : []), [transactions, rules, rule]);
  const chosen = changes.filter((c) => !unticked.has(c.transaction.id));
  const months = new Set(chosen.map((c) => c.transaction.date.slice(0, 7))).size;
  const allTicked = changes.length > 0 && chosen.length === changes.length;

  function close(open: boolean) {
    if (!open) setUnticked(new Set());
    onOpenChange(open);
  }

  function toggle(id: string) {
    const next = new Set(unticked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setUnticked(next);
  }

  function offerUndo(done: RuleChange[], show: typeof toast.success, message: string) {
    show(message, {
      duration: 10_000,
      action: {
        label: "Undo",
        onClick: () =>
          void undoRuleChanges(done, categorizeTransaction).then(
            () => toast.success(`Restored ${plural(done.length, "transaction")}`),
            (e: unknown) => toast.error((e as Error).message),
          ),
      },
    });
  }

  async function apply() {
    setWriting(true);
    try {
      const done = await applyRuleChanges(chosen, categorizeTransaction);
      offerUndo(done, toast.success, `Recategorized ${plural(done.length, "transaction")}`);
      close(false);
    } catch (e) {
      // Rows already written stay written: say so, and keep Undo for them.
      if (e instanceof WriteStoppedError && e.done.length > 0) offerUndo(e.done, toast.error, e.message);
      else toast.error((e as Error).message);
    } finally {
      setWriting(false);
    }
  }

  return (
    <Dialog open={!!rule} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg md:max-h-[90vh] md:overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="break-words">Apply “{rule?.match}” to history</DialogTitle>
          <DialogDescription>
            {rule ? `→ ${categoryName(categories, rule.categoryId)} · ` : ""}Changes spending in {plural(months, "past month")}.
          </DialogDescription>
        </DialogHeader>
        {changes.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nothing to change — every transaction this rule decides is already in its Category.</p>
        ) : (
          <div className="grid gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allTicked} onCheckedChange={() => setUnticked(allTicked ? new Set(changes.map((c) => c.transaction.id)) : new Set())} aria-label="Select all" />
              Select all ({chosen.length} of {changes.length})
            </label>
            <ul className="divide-y rounded-lg border">
              {changes.map((c) => {
                const t = c.transaction;
                return (
                  <li key={t.id} className="flex items-start gap-2 px-2 py-1.5 text-sm">
                    <Checkbox className="mt-0.5" checked={!unticked.has(t.id)} onCheckedChange={() => toggle(t.id)} aria-label={`Recategorize ${t.payee}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 flex-1 break-words">{t.payee}</span>
                        <span className="shrink-0 whitespace-nowrap tabular-nums">
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
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button disabled={chosen.length === 0 || writing} onClick={() => void apply()}>
            Recategorize {chosen.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
