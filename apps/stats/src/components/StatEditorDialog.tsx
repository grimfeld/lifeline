import { useEffect, useState } from "react";
import { normalizeTag, useTagVocabulary } from "@lifeline/core";
import { Button, cn, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, TagInput, toast } from "@lifeline/ui";
import { COLOR_SLOTS, STAT_KINDS, colorVar, type ColorSlot, type Stat, type StatKind } from "../domain/types";
import { addStat, updateStat } from "../data/repo";

const KIND_COPY: Record<StatKind, { title: string; hint: string }> = {
  additive: { title: "Additive", hint: "Increments that add up — push-ups, books" },
  measurement: { title: "Measurement", hint: "Point-in-time readings — weight" },
  boolean: { title: "Boolean", hint: "Did it happen today — workouts, meditation" },
  collection: { title: "Collection", hint: "Distinct things collected — countries" },
};

export function StatEditorDialog({ open, onOpenChange, stat }: { open: boolean; onOpenChange: (o: boolean) => void; stat?: Stat }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<StatKind>("additive");
  const [unit, setUnit] = useState("");
  const [color, setColor] = useState<ColorSlot>("blue");
  const [inc, setInc] = useState("1");
  const [universe, setUniverse] = useState("");
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
          {(kind === "additive" || kind === "measurement") && (
            <div className="grid gap-2">
              <Label htmlFor="stat-unit">Unit</Label>
              <Input id="stat-unit" value={unit} placeholder={kind === "additive" ? "reps" : "kg"} onChange={(e) => setUnit(e.target.value)} />
            </div>
          )}
          {kind === "additive" && (
            <div className="grid gap-2">
              <Label htmlFor="stat-inc">Quick-add amount</Label>
              <Input id="stat-inc" type="number" step="any" value={inc} onChange={(e) => setInc(e.target.value)} />
              <p className="text-muted-foreground text-xs">The + button logs this amount in one tap. Leave empty to always ask.</p>
            </div>
          )}
          {kind === "collection" && (
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
            <div className="flex flex-wrap gap-2">
              {COLOR_SLOTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={cn("size-7 rounded-full border-2 transition-transform", color === c ? "border-foreground scale-110" : "border-transparent")}
                  style={{ background: colorVar(c) }}
                />
              ))}
            </div>
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
