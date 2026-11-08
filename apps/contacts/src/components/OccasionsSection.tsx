import { useState } from "react";
import { Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input, toast } from "@lifeline/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Occasion, Person } from "../domain/types";
import { isBirthday, occasionProblem } from "../domain/occasions";
import { addOccasion, editOccasion, removeOccasion } from "../data/repo";
import { Section } from "./Section";

/** "03-04" reads as "4 March", "1961-03-04" as "4 March 1961". */
export function describeDay(day: string): string {
  const [a, b, c] = day.split("-").map(Number);
  const [y, m, d] = c === undefined ? [null, a, b] : [a, b, c];
  const month = new Date(Date.UTC(2000, (m ?? 1) - 1, 1)).toLocaleString(undefined, { month: "long", timeZone: "UTC" });
  return `${d} ${month}${y ? ` ${y}` : ""}`;
}

/**
 * A Person's Occasions (#404 stories 22-31), added, edited and removed here:
 * a label, a day (the year may be left out) and whether it comes back yearly.
 */
export function OccasionsSection({ person }: { person: Person }) {
  const [editing, setEditing] = useState<Occasion | "new" | null>(null);
  const occasions = person.occasions ?? [];
  return (
    <Section title="Occasions">
      {occasions.length === 0 && <p className="text-muted-foreground text-sm">No occasions yet: a birthday, the day you met, a wedding.</p>}
      <ul className="grid min-w-0 gap-1">
        {occasions.map((o) => (
          <li key={o.id} className="flex min-w-0 items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 break-words">
              <span className="font-medium">{isBirthday(o) ? "🎂 " : ""}{o.label}</span> <span className="text-muted-foreground">· {describeDay(o.day)} · {o.yearly ? "every year" : "once"}</span>
            </span>
            <Button variant="ghost" size="icon" aria-label={`Edit ${o.label}`} onClick={() => setEditing(o)}>
              <Pencil />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Remove ${o.label}`}
              onClick={() => removeOccasion(person.id, o.id).catch((e) => toast.error(`${o.label} could not be removed.`, { description: e instanceof Error ? e.message : String(e) }))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="outline" size="sm" onClick={() => setEditing("new")}>
          <Plus /> Add occasion
        </Button>
      </div>
      <OccasionDialog personId={person.id} editing={editing} onClose={() => setEditing(null)} />
    </Section>
  );
}

function OccasionDialog({ personId, editing, onClose }: { personId: string; editing: Occasion | "new" | null; onClose: () => void }) {
  return (
    <Dialog open={editing !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">{editing !== null && <OccasionForm key={editing === "new" ? "new" : editing.id} personId={personId} editing={editing} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function OccasionForm({ personId, editing, onClose }: { personId: string; editing: Occasion | "new"; onClose: () => void }) {
  const from = editing === "new" ? null : editing;
  const [label, setLabel] = useState(from?.label ?? "");
  const [day, setDay] = useState(from?.day ?? "");
  const [yearly, setYearly] = useState(from?.yearly ?? true);
  const [error, setError] = useState("");

  async function save() {
    const input = { label, day, yearly };
    const problem = occasionProblem({ label: label.trim(), day: day.trim(), yearly });
    if (problem) return setError(problem);
    try {
      if (from) await editOccasion(personId, from.id, input);
      else await addOccasion(personId, input);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{from ? "Edit occasion" : "Add an occasion"}</DialogTitle>
        <DialogDescription>A named day in their life. Birthday gives their age.</DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Label" hint="Birthday, Met, Wedding… any word.">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Birthday" autoFocus />
        </Field>
        <Field label="Day" hint="YYYY-MM-DD, or MM-DD when you don't know the year." error={error || undefined}>
          <Input value={day} onChange={(e) => setDay(e.target.value)} placeholder="1961-03-04" inputMode="numeric" />
        </Field>
        {/* The box before its words, as a checkbox reads. */}
        <Field label="Every year" className="flex flex-row-reverse items-center justify-end gap-2">
          <Checkbox checked={yearly} onCheckedChange={(c) => setYearly(c === true)} />
        </Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Save</Button>
        </DialogFooter>
      </form>
    </>
  );
}
