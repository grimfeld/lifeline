import { useEffect, useState } from "react";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import { Button, cn, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, TagInput, Textarea, toast } from "@lifeline/ui";
import { STAT_KINDS, type ColorSlot, type Stat, type StatKind } from "../domain/types";
import { ColorSwatches, KIND_COPY, kindHas } from "./StatFields";
import { addStat, updateStat } from "../data/repo";
import { cleanItemList } from "../domain/aggregate";

export function StatEditorDialog({ open, onOpenChange, stat }: { open: boolean; onOpenChange: (o: boolean) => void; stat?: Stat }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<StatKind>("additive");
  const [unit, setUnit] = useState("");
  const [color, setColor] = useState<ColorSlot>("blue");
  const [inc, setInc] = useState("1");
  const [universe, setUniverse] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setName(stat?.title ?? "");
    setKind(stat?.kind ?? "additive");
    setUnit(stat?.unit ?? "");
    setColor(stat?.color ?? "blue");
    setInc(stat ? String(stat.defaultIncrement || "") : "1");
    setUniverse(stat?.universeSize ? String(stat.universeSize) : "");
    setItemsText((stat?.items ?? []).join("\n"));
    setTags(stat?.tags ?? []);
  }, [open, stat]);

  async function submit() {
    if (!name.trim()) return void toast.error("Name required");
    const input = {
      title: name.trim(),
      unit,
      color,
      defaultIncrement: Number(inc) || 0,
      universeSize: Number(universe) || 0,
      items: cleanItemList(itemsText.split("\n")),
      tags,
    };
    if (stat) {
      await updateStat(stat, input);
      toast.success("Stat updated");
    } else {
      await addStat({ ...input, kind });
      toast.success("Stat created");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{stat ? "Edit stat" : "New stat"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="stat-name">Name</Label>
            <Input id="stat-name" value={name} autoFocus placeholder="Push-ups" onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Kind</Label>
            <div className="grid grid-cols-2 gap-2">
              {STAT_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={!!stat}
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "rounded-lg border p-2 text-left transition-colors disabled:opacity-60",
                    kind === k ? "border-primary bg-accent" : "hover:bg-accent/50",
                  )}
                >
                  <span className="block text-sm font-medium">{KIND_COPY[k].title}</span>
                  <span className="text-muted-foreground block text-xs">{KIND_COPY[k].hint}</span>
                </button>
              ))}
            </div>
            {stat && <p className="text-muted-foreground text-xs">Kind is fixed after creation — entries would mean something else.</p>}
          </div>
          {kindHas(kind).unit && (
            <div className="grid gap-2">
              <Label htmlFor="stat-unit">Unit</Label>
              <Input id="stat-unit" value={unit} placeholder={kind === "additive" ? "reps" : "kg"} onChange={(e) => setUnit(e.target.value)} />
            </div>
          )}
          {kindHas(kind).increment && (
            <div className="grid gap-2">
              <Label htmlFor="stat-inc">Quick-add amount</Label>
              <Input id="stat-inc" type="number" step="any" value={inc} onChange={(e) => setInc(e.target.value)} />
              <p className="text-muted-foreground text-xs">The + button logs this amount in one tap. Leave empty to always ask.</p>
            </div>
          )}
          {kind === "collection" && (
            <div className="grid gap-2">
              <Label htmlFor="stat-items">Items (optional)</Label>
              <Textarea id="stat-items" value={itemsText} rows={4} className="max-h-48" placeholder={"France\nJapan\nPeru"} onChange={(e) => setItemsText(e.target.value)} />
              <p className="text-muted-foreground text-xs">One per line. Logging becomes a checklist of these; the list's length is the total.</p>
            </div>
          )}
          {kind === "collection" && !itemsText.trim() && (
            <div className="grid gap-2">
              <Label htmlFor="stat-universe">Out of (optional)</Label>
              <Input id="stat-universe" type="number" min={0} value={universe} placeholder="195" onChange={(e) => setUniverse(e.target.value)} />
              <p className="text-muted-foreground text-xs">How many exist in total — shown as "5 / 195". A fact, not a goal.</p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="stat-tags">Tags</Label>
            <TagInput id="stat-tags" value={tags} onChange={setTags} suggestions={suggestions} normalize={normalizeTag} placeholder="garden, health…" />
          </div>
          <div className="grid gap-2">
            <Label>Color</Label>
            <ColorSwatches value={color} onChange={setColor} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{stat ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
