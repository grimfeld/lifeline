import { useMemo, useState } from "react";
import { Badge, Button, Card, CardContent, Input, toast } from "@lifeline/ui";
import { Ban, Pencil, Pin, Plus, Wand2 } from "lucide-react";
import type { CategorizeRule, LedgerCategory, Transaction } from "../domain/types";
import { matchRule, normalizePayee, payeeCategoryIndex, ruleCoverage } from "../domain/suggest";
import { neverRule, pinRule, useCategories, useCategorizeRules, useTransactions } from "../data/repo";
import { RuleEditorDialog } from "./RuleEditorDialog";

const PAGE = 40;

interface HistoryLine {
  key: string;
  /** The newest spelling of the payee — what a pin or a never is written from. */
  payee: string;
  kind: "expense" | "income";
  categoryId: string;
  count: number;
}

/** What history hands out per payee, with its newest spelling and how many transactions stand behind it. */
function historyLines(transactions: Transaction[]): HistoryLine[] {
  const counts = new Map<string, number>();
  const newest = new Map<string, string>();
  for (const t of transactions) {
    if (t.kind !== "expense" && t.kind !== "income") continue;
    const key = normalizePayee(t.payee);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    // useTransactions() reads newest first, so the first spelling seen is the newest.
    if (!newest.has(key)) newest.set(key, t.payee);
  }
  return payeeCategoryIndex(transactions)
    .map((e) => ({ key: e.key, payee: newest.get(e.key) ?? e.key, kind: e.kind, categoryId: e.categoryId, count: counts.get(e.key) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.payee.localeCompare(b.payee));
}

function categoryLabel(categories: LedgerCategory[], id: string): string {
  const c = categories.find((x) => x.id === id);
  if (!c) return "Unknown category";
  return c.group ? `${c.group} · ${c.title}` : c.title;
}

/**
 * The Rules panel (ADR 0040): every auto-categorization the ledger would
 * make, in one place — the hand-made Categorize rules on top, and below them
 * the reading history does on its own, which is where most of the work
 * happens and where nothing needed maintaining before. A derived line can be
 * pinned into a rule (it then stops moving with the ledger) or vetoed with
 * never; a rule can be edited or deleted back to the reading underneath.
 * Rules never touch the ledger by themselves — they only shape what the
 * import preview and the Auto-categorize sweep suggest.
 */
export function RulesPanel() {
  const transactions = useTransactions();
  const categories = useCategories();
  const rules = useCategorizeRules();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [addOpen, setAddOpen] = useState(false);
  const [addNever, setAddNever] = useState(false);
  const [editing, setEditing] = useState<CategorizeRule | undefined>();

  const coverage = useMemo(() => ruleCoverage(transactions, rules), [transactions, rules]);
  const history = useMemo(() => historyLines(transactions), [transactions]);

  const q = search.trim().toLowerCase();
  const shownRules = useMemo(() => rules.filter((r) => !q || `${r.match} ${categoryLabel(categories, r.categoryId)}`.toLowerCase().includes(q)), [rules, categories, q]);
  const shownHistory = useMemo(() => history.filter((h) => !q || `${h.payee} ${categoryLabel(categories, h.categoryId)}`.toLowerCase().includes(q)), [history, categories, q]);

  async function run(action: Promise<unknown>, ok: string) {
    try {
      await action;
      toast.success(ok);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setAddNever(false);
            setAddOpen(true);
          }}
        >
          <Plus /> New rule
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setAddNever(true);
            setAddOpen(true);
          }}
        >
          <Ban /> Never categorize a payee
        </Button>
      </div>
      <p className="text-muted-foreground text-xs">
        Auto-categorization reads the ledger itself: the category you last gave a payee is what the import preview and the <Wand2 className="inline size-3" /> sweep suggest for it next time. Rules sit over that reading — a payee that always means one
        category, or a payee that should never be guessed at all (Amazon: one name, twenty categories). Nothing here writes to the ledger on its own; suggestions still land in front of you.
      </p>
      <Input placeholder="Search payee or category…" value={search} onChange={(e) => setSearch(e.target.value)} />

      <h2 className="text-sm font-semibold">
        Rules
        <span className="text-muted-foreground ml-2 text-xs font-normal">{rules.length === 0 ? "none yet — history does all the work" : `${rules.length} hand-made, they win over history`}</span>
      </h2>
      {shownRules.map((r) => (
        <Card key={r.id} className={`py-2 ${r.never ? "border-dashed" : ""}`}>
          <CardContent className="flex items-center gap-3 px-4">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {r.match}
                <Badge variant="outline" className="ml-2">
                  {r.mode}
                </Badge>
                {r.never ? (
                  <Badge variant="outline" className="ml-1 border-amber-500/60 text-amber-600">
                    never
                  </Badge>
                ) : (
                  <Badge variant="outline" className="ml-1">
                    {r.kind === "income" ? "income" : "expense"}
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground text-xs">
                {r.never ? "Never auto-categorized — matching rows land in the inbox" : `→ ${categoryLabel(categories, r.categoryId)}`}
                {" · "}
                {coverage.get(r.id) ?? 0} payee{(coverage.get(r.id) ?? 0) === 1 ? "" : "s"} in the ledger
              </div>
            </div>
            <Button size="icon" variant="ghost" className="size-8" title="Edit this rule" onClick={() => setEditing(r)}>
              <Pencil />
            </Button>
          </CardContent>
        </Card>
      ))}
      {rules.length > 0 && shownRules.length === 0 && <p className="text-muted-foreground text-sm">No rule matches that search.</p>}

      <h2 className="mt-2 text-sm font-semibold">
        From history
        <span className="text-muted-foreground ml-2 text-xs font-normal">{history.length} payee{history.length === 1 ? "" : "s"} the ledger already answers for — derived, nothing stored</span>
      </h2>
      {shownHistory.slice(0, limit).map((h) => {
        const ruled = matchRule(h.payee, h.kind, rules);
        return (
          <Card key={h.key} className={`py-2 ${ruled ? "opacity-60" : ""}`}>
            <CardContent className="flex items-center gap-3 px-4">
              <div className="min-w-0 flex-1">
                <div className="truncate">
                  {h.payee}
                  {h.kind === "income" && (
                    <Badge variant="outline" className="ml-2">
                      income
                    </Badge>
                  )}
                  {ruled && (
                    <Badge variant="outline" className={`ml-2 ${ruled.never ? "border-amber-500/60 text-amber-600" : ""}`}>
                      {ruled.never ? `never · ${ruled.match}` : `rule · ${ruled.match}`}
                    </Badge>
                  )}
                </div>
                <div className="text-muted-foreground text-xs">
                  → {categoryLabel(categories, h.categoryId)} · {h.count} transaction{h.count === 1 ? "" : "s"}
                </div>
              </div>
              {!ruled && (
                <>
                  <Button size="sm" variant="ghost" title="Pin this reading as a rule — it stops moving with the ledger" onClick={() => void run(pinRule(h.payee, h.categoryId), `“${h.payee}” pinned to ${categoryLabel(categories, h.categoryId)}`)}>
                    <Pin /> Pin
                  </Button>
                  <Button size="sm" variant="ghost" className="text-amber-600" title="Never auto-categorize this payee" onClick={() => void run(neverRule(h.payee), `“${h.payee}” is never auto-categorized`)}>
                    <Ban /> Never
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        );
      })}
      {shownHistory.length > limit && (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setLimit((n) => n + PAGE)}>
            Show more ({shownHistory.length - limit} left)
          </Button>
        </div>
      )}
      {history.length === 0 && <p className="text-muted-foreground text-sm">Nothing to read yet — categorize a few transactions and this fills itself in.</p>}

      <RuleEditorDialog open={addOpen} onOpenChange={setAddOpen} initialNever={addNever} initialMatch={search.trim()} />
      <RuleEditorDialog open={!!editing} onOpenChange={(o) => !o && setEditing(undefined)} rule={editing} />
    </div>
  );
}
