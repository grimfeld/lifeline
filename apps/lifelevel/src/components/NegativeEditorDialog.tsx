import { useEffect, useState } from "react";
import { useTagVocabulary } from "@lifeline/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TagInput,
  toast,
} from "@lifeline/ui";
import { GRAVITIES, type Gravity, type Negative } from "../domain/types";
import { addNegative, updateNegative, useHabits } from "../data/repo";

export const GRAVITY_COPY: Record<Gravity, string> = {
  minor: "Minor — a slip",
  severe: "Severe — real harm",
  catastrophic: "Catastrophic — deep damage",
};

const RANDOM = "__random__";

export function NegativeEditorDialog({ open, onOpenChange, negative }: { open: boolean; onOpenChange: (o: boolean) => void; negative?: Negative }) {
  const habits = useHabits();
  const [name, setName] = useState("");
  const [gravity, setGravity] = useState<Gravity>("minor");
  const [target, setTarget] = useState<string>(RANDOM);
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setName(negative?.title ?? "");
    setGravity(negative?.gravity ?? "minor");
    setTarget(negative?.affectsHabitId || RANDOM);
    setTags(negative?.tags ?? []);
  }, [open, negative]);

  async function submit() {
    if (!name.trim()) return void toast.error("Name required");
    const input = { title: name, gravity, affectsHabitId: target === RANDOM ? "" : target, tags };
    if (negative) {
      await updateNegative(negative, input);
      toast.success("Negative updated");
    } else {
      await addNegative(input);
      toast.success("Negative created — now avoid it");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{negative ? "Edit negative" : "New negative"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="negative-name">Name</Label>
            <Input id="negative-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          <div className="grid gap-2">
            <Label>Gravity</Label>
            <Select value={gravity} onValueChange={(v) => setGravity(v as Gravity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRAVITIES.map((g) => (
                  <SelectItem key={g} value={g}>
                    {GRAVITY_COPY[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Severity of the real-life consequence — punishment scales with harm, not effort.</p>
          </div>
          <div className="grid gap-2">
            <Label>Rival habit</Label>
            <Select value={target} onValueChange={setTarget}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={RANDOM}>Random — chaos picks a fresh victim each log</SelectItem>
                {habits.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Fixed pairs a vice with the virtue it undoes; random is more destructive because it is unjust.</p>
          </div>
          <div className="grid gap-2">
            <Label>Tags</Label>
            <TagInput value={tags} onChange={setTags} suggestions={suggestions} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()}>{negative ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
