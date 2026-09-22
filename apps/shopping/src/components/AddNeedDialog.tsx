import { useEffect, useMemo, useRef, useState } from "react";
import type { Handoff } from "@lifeline/core";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Input, Label, toast } from "@lifeline/ui";
import { ChevronDown, ChevronRight } from "lucide-react";
import { suggestions } from "../domain/rules";
import { addNeed, useNeeds, type AddResult } from "../data/repo";
import { AisleSelect } from "./AisleSelect";

function announce(title: string, res: AddResult) {
  if (!res) return;
  if (res.kind === "listed") toast.info(`${title} — already on the list`);
  else if (res.kind === "revive") toast.success(`${title} — back on the list`);
  else toast.success(`${title} added`);
}

/**
 * The capture (ADR 0055): one focused title, past Needs offered back while
 * typing, Aisle and note tucked away. Enter adds and stays open, cleared —
 * "milk ⏎ eggs ⏎ bread ⏎" is three Needs. Opened with a Handoff (the
 * Intake), it arrives prefilled and closes on its one save.
 */
export function AddNeedDialog({ open, onOpenChange, handoff, defaultAisleId }: { open: boolean; onOpenChange: (o: boolean) => void; handoff?: Handoff; defaultAisleId?: string }) {
  const needs = useNeeds();
  const offered = useMemo(() => suggestions(needs), [needs]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [aisleId, setAisleId] = useState("");
  const [more, setMore] = useState(false);
  const [added, setAdded] = useState<string[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(handoff?.title ?? "");
    setNote(handoff?.text?.trim() ?? "");
    setAisleId(defaultAisleId ?? "");
    setMore(!!handoff?.text?.trim());
    setAdded([]);
  }, [open, handoff, defaultAisleId]);

  async function add() {
    const t = title.trim();
    if (!t) return;
    const res = await addNeed({ title: t, note, aisleId });
    announce(t, res);
    if (handoff) {
      onOpenChange(false);
      return;
    }
    if (res && res.kind !== "listed") setAdded((a) => [...a, t]);
    setTitle("");
    setNote("");
    titleRef.current?.focus();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add to the shopping list</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <Input
            ref={titleRef}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need?"
            aria-label="Need"
            list="shopping-past-needs"
            autoFocus
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void add();
              }
            }}
          />
          <datalist id="shopping-past-needs">
            {offered.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <button type="button" className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs" onClick={() => setMore((m) => !m)}>
            {more ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />} Aisle & note
          </button>
          {more && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>Aisle</Label>
                <AisleSelect value={aisleId} onChange={setAisleId} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="need-note">Note</Label>
                <Input id="need-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="2 L, the blue one…" onKeyDown={(e) => e.key === "Enter" && void add()} />
              </div>
            </div>
          )}
          {added.length > 0 && <div className="text-muted-foreground text-xs">Added: {added.join(", ")}</div>}
        </div>
        <DialogFooter className="gap-2">
          {!handoff && (
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          )}
          <Button type="button" disabled={!title.trim()} onClick={() => void add()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
