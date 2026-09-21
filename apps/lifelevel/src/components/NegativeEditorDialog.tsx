import { useEffect, useMemo, useState } from "react";
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
import { Trash2 } from "lucide-react";
import { GRAVITIES, type Gravity, type Negative } from "../domain/types";
import { addNegative, deleteCompletion, deleteNegative, updateNegative, useHabits, useNegativeCompletions } from "../data/repo";

export const GRAVITY_COPY: Record<Gravity, string> = {
  minor: "Minor — a slip",
  severe: "Severe — real harm",
  catastrophic: "Catastrophic — deep damage",
};

const RANDOM = "__random__";

export function NegativeEditorDialog({ open, onOpenChange, negative }: { open: boolean; onOpenChange: (o: boolean) => void; negative?: Negative }) {
  const habits = useHabits();
  const negativeCompletions = useNegativeCompletions();
  const [name, setName] = useState("");
  const [gravity, setGravity] = useState<Gravity>("minor");
  const [target, setTarget] = useState<string>(RANDOM);
  const [tags, setTags] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const suggestions = useTagVocabulary().map((v) => v.tag);

  useEffect(() => {
    if (!open) return;
    setName(negative?.title ?? "");
    setGravity(negative?.gravity ?? "minor");
    setTarget(negative?.affectsHabitId || RANDOM);
    setTags(negative?.tags ?? []);
    setConfirmDelete(false);
  }, [open, negative]);

  const habitById = useMemo(() => new Map(habits.map((h) => [h.id, h])), [habits]);
  /**
   * This Negative's own ledger, newest first. A random Negative lands wherever
   * the roll sent it, so this — not the victim Habit's page — is where a
   * mis-logged confession is found again and struck out.
   */
  const logs = useMemo(
    () => (negative ? negativeCompletions.filter((c) => c.negativeId === negative.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) : []),
    [negative, negativeCompletions],
  );

  /** Two taps, no dialog-over-dialog: the button says what it will take with it. */
  async function remove() {
    if (!negative) return;
    if (!confirmDelete) return void setConfirmDelete(true);
    await deleteNegative(negative.id);
    toast.success(logs.length > 0 ? `Negative and its ${logs.length} log${logs.length === 1 ? "" : "s"} deleted — that damage is undone` : "Negative deleted");
    onOpenChange(false);
  }

  async function removeLog(id: string) {
    await deleteCompletion(id);
    toast.success("Log removed — the XP damage is undone");
  }

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
      {/* On a phone the dialog is a full-screen sheet: the fields keep their natural height
          (content-start) and the actions ride the bottom of the screen, not the middle. On a
          desktop the log list can make it tall, so the dialog scrolls rather than run off-screen. */}
      <DialogContent className="max-md:grid-rows-[auto_1fr_auto] md:max-h-[85vh] md:overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{negative ? "Edit negative" : "New negative"}</DialogTitle>
        </DialogHeader>
        <div className="grid content-start gap-4">
          <div className="grid gap-2">
            <Label htmlFor="negative-name">Name</Label>
            <Input id="negative-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void submit()} />
          </div>
          <div className="grid gap-2">
            <Label>Gravity</Label>
            <Select value={gravity} onValueChange={(v) => setGravity(v as Gravity)}>
              <SelectTrigger className="w-full">
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
              <SelectTrigger className="w-full">
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
          {negative && (
            <div className="grid gap-2">
              <Label>Logged {logs.length}×</Label>
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-xs">Never logged. Keep it that way.</p>
              ) : (
                <ul className="grid max-h-40 gap-1 overflow-y-auto">
                  {logs.slice(0, 50).map((c) => (
                    <li key={c.id} className="bg-muted/40 flex items-center gap-2 rounded-md px-2 py-1 text-xs">
                      <span className="min-w-0 flex-1 truncate">
                        <span className="tabular-nums">{new Date(c.occurredAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                        <span className="text-muted-foreground"> · hit {habitById.get(c.affectedHabitId)?.title ?? "a deleted habit"}</span>
                        {c.note && <span className="text-muted-foreground"> · {c.note}</span>}
                      </span>
                      <Button size="icon" variant="ghost" className="size-6 shrink-0" title="Delete log" onClick={() => void removeLog(c.id)}>
                        <Trash2 className="size-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-muted-foreground text-xs">A log deleted here gives the Habit it hit its XP back — the cure for a mis-tap.</p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {negative ? (
            <Button variant={confirmDelete ? "destructive" : "ghost"} onClick={() => void remove()}>
              {confirmDelete ? (logs.length > 0 ? `Delete with ${logs.length} log${logs.length === 1 ? "" : "s"}` : "Really delete") : "Delete"}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submit()}>{negative ? "Save" : "Create"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
