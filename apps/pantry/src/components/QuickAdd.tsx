import { useState } from "react";
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, toast } from "@lifeline/ui";
import { quickAdd, useStorages } from "../data/repo";

/**
 * One-line add: type a product, pick a Storage, Enter. The same title in
 * the same Storage restocks (+1) instead of duplicating (ADR 0043).
 */
export function QuickAdd({ defaultStorageId, autoFocus }: { defaultStorageId?: string; autoFocus?: boolean }) {
  const storages = useStorages();
  const [text, setText] = useState("");
  const [chosen, setChosen] = useState("");
  const storageId = chosen || defaultStorageId || storages[0]?.id || "";

  async function add() {
    const res = await quickAdd(text, storageId);
    if (!res) return;
    const name = text.trim();
    toast.success(res.restocked ? `${name} — one more in stock` : `${name} added`);
    setText("");
  }

  if (storages.length === 0) {
    return <div className="text-muted-foreground flex h-full items-center justify-center text-sm">Create a storage first.</div>;
  }
  return (
    <div className="flex items-center gap-2">
      <Input aria-label="Add or restock" value={text} onChange={(e) => setText(e.target.value)} placeholder="Add or restock…" autoFocus={autoFocus} onKeyDown={(e) => e.key === "Enter" && void add()} />
      <Select value={storageId} onValueChange={setChosen}>
        <SelectTrigger aria-label="Storage" className="w-32 shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {storages.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
