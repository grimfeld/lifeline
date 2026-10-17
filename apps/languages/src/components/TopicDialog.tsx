import { useEffect, useState } from "react";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, TallyEditor, toast } from "@lifeline/ui";
import { useLoggableTargets, type Tally } from "@lifeline/core";
import { DEFAULT_NEW_CAP, type Topic } from "../domain/types";
import { addTopic, deleteTopic, setActiveTopic, setTopicArchived, updateTopic } from "../data/repo";

/**
 * New / edit Topic (CONTEXT.md "Topic"): a name, the daily new cap, and
 * the Tallies a day practised fires (ADR 0059). One that holds anything is
 * archived, never deleted.
 */
export function TopicDialog({ open, onOpenChange, topic, holds = 0 }: { open: boolean; onOpenChange: (open: boolean) => void; topic?: Topic; holds?: number }) {
  const targets = useLoggableTargets();
  const [name, setName] = useState("");
  const [cap, setCap] = useState(String(DEFAULT_NEW_CAP));
  const [tallies, setTallies] = useState<Tally[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(topic?.name ?? "");
    setCap(String(topic?.newCap ?? DEFAULT_NEW_CAP));
    setTallies(topic?.tallies as Tally[] | undefined ?? []);
    setConfirmDelete(false);
  }, [open, topic]);

  async function save() {
    const newCap = Number(cap);
    if (!Number.isFinite(newCap) || newCap < 0) return void toast.error("The daily new cap must be 0 or more");
    try {
      if (topic) {
        await updateTopic(topic, { name, newCap, tallies });
        toast.success("Topic updated");
      } else {
        const id = await addTopic({ name, newCap, tallies });
        setActiveTopic(id);
        toast.success(`${name.trim()} added`);
      }
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    onOpenChange(false);
  }

  async function archive() {
    if (!topic) return;
    await setTopicArchived(topic.id, !topic.archived);
    toast.success(topic.archived ? `${topic.name} is back` : `${topic.name} archived — everything kept`);
    onOpenChange(false);
  }

  async function remove() {
    if (!topic) return;
    if (!confirmDelete) return void setConfirmDelete(true);
    try {
      await deleteTopic(topic.id);
    } catch (err) {
      return void toast.error((err as Error).message);
    }
    toast.success("Topic deleted");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{topic ? `Edit ${topic.name}` : "New topic"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="grid gap-2">
              <Label htmlFor="lg-name">Name</Label>
              <Input id="lg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spanish, History…" autoFocus onKeyDown={(e) => e.key === "Enter" && void save()} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="lg-cap">New per day</Label>
              <Input id="lg-cap" value={cap} onChange={(e) => setCap(e.target.value)} inputMode="numeric" onKeyDown={(e) => e.key === "Enter" && void save()} />
            </div>
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">At most this many new prompts enter practice each day, always after what is due.</p>
          <div className="grid gap-2">
            <Label>Tallies</Label>
            <TallyEditor tallies={tallies} onChange={setTallies} targets={targets} occurrence="day practised" />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {topic ? (
            holds > 0 ? (
              <Button variant="ghost" onClick={() => void archive()}>
                {topic.archived ? "Unarchive" : "Archive"}
              </Button>
            ) : (
              <Button variant={confirmDelete ? "destructive" : "ghost"} onClick={() => void remove()}>
                {confirmDelete ? "Really delete" : "Delete"}
              </Button>
            )
          ) : (
            <span />
          )}
          <Button onClick={() => void save()}>{topic ? "Save" : "Create"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
