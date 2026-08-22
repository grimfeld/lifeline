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
import { DIFFICULTIES, type Difficulty, type Habit } from "../domain/types";
import { addHabit, updateHabit } from "../data/repo";

export const DIFFICULTY_COPY: Record<Difficulty, string> = {
  easy: "Easy — light lift, quick decay",
  normal: "Normal",
  hard: "Hard — more XP, gentler decay",
  expert: "Expert",
  master: "Master — top XP, slowest decay",
};

export function HabitEditorDialog({ open, onOpenChange, habit }: { open: boolean; onOpenChange: (o: boolean) => void; habit?: Habit }) {
  const [name, setName] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  const [tags, setTags] = useState<string[]>([]);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setName(habit?.title ?? "");
    setDifficulty(habit?.difficulty ?? "normal");
    setTags(habit?.tags ?? []);
  }, [open, habit]);

  async function submit() {
    if (!name.trim()) return void toast.error("Name required");
    if (habit) {
      const changed = habit.difficulty !== difficulty;
      await updateHabit(habit, { title: name, difficulty, tags });
      toast.success(changed ? "Habit updated — the whole ledger re-values at the new difficulty" : "Habit updated");
    } else {
      await addHabit({ title: name, difficulty, tags });
      toast.success("Habit created — go earn XP");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{habit ? "Edit habit" : "New habit"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="habit-name">Name</Label>
            <Input id="habit-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          <div className="grid gap-2">
            <Label>Difficulty</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DIFFICULTIES.map((d) => (
                  <SelectItem key={d} value={d}>
                    {DIFFICULTY_COPY[d]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Self-assessed: how unpleasant it is plus how long it takes. Changing it later re-values all past XP.</p>
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
          <Button onClick={() => void submit()}>{habit ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
