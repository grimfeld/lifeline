import { useState } from "react";
import { Button, Checkbox, ChoiceField, DatePicker, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input } from "@lifeline/ui";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { Occasion, Person } from "../domain/types";
import { isBirthday } from "../domain/occasions";
import { addOccasion, editOccasion, removePart, restorePart } from "../data/repo";
import { removeWithUndo } from "./writes";
import { Section } from "./Section";

/** "03-04" reads as "4 March", "1961-03-04" as "4 March 1961", in the reader's own order. A yearless day is read in 2000, a leap year, so 29 February reads too. */
export function describeDay(day: string): string {
  const [a, b, c] = day.split("-").map(Number);
  const [y, m, d] = c === undefined ? [null, a, b] : [a, b, c];
  return new Date(Date.UTC(y ?? 2000, (m ?? 1) - 1, d ?? 1)).toLocaleDateString(undefined, { day: "numeric", month: "long", year: y === null ? undefined : "numeric", timeZone: "UTC" });
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
              onClick={() => void removeWithUndo(o.label, () => removePart(person.id, "occasions", o.id), (r) => restorePart(person.id, "occasions", r))}
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
  // "03-04": a day whose year I don't know. Only a yearly Occasion may lack one.
  const [noYear, setNoYear] = useState(from?.day.length === 5);
  const [error, setError] = useState("");

  async function save() {
    const input = { label, day: yearly && noYear ? day.slice(-5) : day, yearly };
    // The repo checks the Occasion before saving and throws its problem, shown below.
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
        {/* The boxes before their words, as a checkbox reads. */}
        <Field label="Every year" className="flex flex-row-reverse items-center justify-end gap-2">
          <Checkbox checked={yearly} onCheckedChange={(c) => setYearly(c === true)} />
        </Field>
        {yearly && (
          <Field label="I don't know the year" className="flex flex-row-reverse items-center justify-end gap-2">
            <Checkbox
              checked={noYear}
              onCheckedChange={(c) => {
                setNoYear(c === true);
                // Without a year, keep the month and day; with one again, the year is to pick.
                setDay(c === true ? day.slice(-5) : "");
              }}
            />
          </Field>
        )}
        {yearly && noYear ? (
          <MonthDayField value={day.slice(-5)} onChange={setDay} error={error} />
        ) : (
          <Field label="Day" error={error || undefined}>
            <DatePicker value={day.length === 10 ? day : ""} onChange={setDay} required aria-label="Day" />
          </Field>
        )}
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

const MONTHS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1).padStart(2, "0"),
  label: new Date(Date.UTC(2000, i, 1)).toLocaleDateString(undefined, { month: "long", timeZone: "UTC" }),
}));

/** How many days a month has at most: 29 for February, so 29 February can be given. */
const daysIn = (month: string) => (month ? new Date(Date.UTC(2000, Number(month), 0)).getUTCDate() : 31);

/** A day of the year with no year ("03-04"): a month, then a day of it, 29 February included. */
function MonthDayField({ value, onChange, error }: { value: string; onChange: (day: string) => void; error: string }) {
  const [month = "", dayOfMonth = ""] = value.split("-");
  const dayOptions = Array.from({ length: daysIn(month) }, (_, i) => ({ value: String(i + 1).padStart(2, "0"), label: String(i + 1) }));
  // A day past the new month's end (31, then April) becomes its last day.
  const set = (m: string, d: string) => onChange(`${m}-${d && Number(d) > daysIn(m) ? String(daysIn(m)) : d}`);
  return (
    <div className="grid min-w-0 gap-1.5">
      <div className="grid min-w-0 grid-cols-2 gap-3">
        <ChoiceField label="Month" value={month} options={MONTHS} onCommit={(m) => set(m, dayOfMonth)} />
        <ChoiceField label="Day" value={dayOfMonth} options={dayOptions} onCommit={(d) => set(month, d)} />
      </div>
      {error && <p data-slot="field-error" className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
