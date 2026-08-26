import { useEffect, useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import type { CategoryKind, LedgerCategory } from "../domain/types";
import { editAmount, parseAmount } from "../domain/money";
import { addCategory, deleteCategory, mergeCategory, updateCategory, useCategories } from "../data/repo";

/**
 * A Category (ADR 0033): kind, display group, standing Target, accumulating
 * flag. A referenced one can only be merged away — the merge picker is here.
 */
export function CategoryEditorDialog({ open, onOpenChange, category, initialKind }: { open: boolean; onOpenChange: (open: boolean) => void; category?: LedgerCategory; initialKind?: CategoryKind }) {
  const categories = useCategories();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [group, setGroup] = useState("");
  const [target, setTarget] = useState("");
  const [accumulating, setAccumulating] = useState(false);
  const [mergeInto, setMergeInto] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(category?.title ?? "");
    setKind(category?.kind ?? initialKind ?? "expense");
    setGroup(category?.group ?? "");
    setTarget(category && category.target ? editAmount(category.target) : "");
    setAccumulating(category?.accumulating ?? false);
    setMergeInto("");
  }, [open, category, initialKind]);

  async function submit() {
    if (!title.trim()) return void toast.error("Name required");
    const cents = target.trim() ? parseAmount(target) : 0;
    if (cents === null || cents < 0) return void toast.error("Target must be a number");
    const input = { title, kind, group, target: cents, accumulating };
    if (category) {
      await updateCategory(category, input);
      toast.success("Category updated");
    } else {
      await addCategory(input);
      toast.success("Category added");
    }
    onOpenChange(false);
  }

  async function remove() {
    if (!category) return;
    try {
      if (mergeInto) {
        await mergeCategory(category.id, mergeInto);
        toast.success("Merged");
      } else {
        await deleteCategory(category.id);
        toast.success("Category deleted");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const mergeTargets = categories.filter((c) => c.id !== category?.id && c.kind === kind);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{category ? "Edit category" : "New category"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="cat-title">Name</Label>
            <Input id="cat-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Groceries" autoFocus onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CategoryKind)} disabled={!!category}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cat-group">Group</Label>
              <Input id="cat-group" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Fixed costs" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cat-target">Monthly target</Label>
            <Input id="cat-target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="400" inputMode="decimal" />
            {kind === "income" && <p className="text-muted-foreground text-xs">Income targets are allowed; the Budget screen ignores them.</p>}
          </div>
          {kind === "expense" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={accumulating} onCheckedChange={(v) => setAccumulating(v === true)} />
              Accumulating — a sinking fund: unspent target rolls into next month
            </label>
          )}
          {category && (
            <div className="grid gap-2 rounded-md border p-2">
              <Label>Delete — a used category must merge into another</Label>
              <Select value={mergeInto} onValueChange={setMergeInto}>
                <SelectTrigger>
                  <SelectValue placeholder="No merge (only works when unused)" />
                </SelectTrigger>
                <SelectContent>
                  {mergeTargets.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.group ? `${c.group} · ${c.title}` : c.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" className="text-destructive justify-self-start" onClick={() => void remove()}>
                {mergeInto ? "Merge & delete" : "Delete"}
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{category ? "Save" : "Add category"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
