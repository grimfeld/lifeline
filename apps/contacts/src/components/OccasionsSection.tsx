import { useState } from "react";
import { Button, Checkbox, ChoiceField, DatePicker, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Field, Input } from "@lifeline/ui";
import { CalendarHeart } from "lucide-react";
import { todayStr } from "@lifeline/core";
import type { Occasion, Person } from "../domain/types";
import { dotJoin } from "../domain/dots";
import { describeDay, isBirthday, occasionDayProblem, occasionLabelProblem, upcomingOccasions, whenOf } from "../domain/occasions";
import { addOccasion, editOccasion, removePart, restorePart } from "../data/repo";
import { asksMonthDay, dayWhenNoYear, daysIn, monthDay, occasionDraft, occasionInput, pickerDay, type OccasionDraft } from "../domain/occasionForm";
import { message, removeWithUndo } from "./writes";
import { Section } from "./Section";
import { AddRow, CardList, CardRow } from "./Cards";

/**
 * A Person's Occasions (#404 stories 22-31), added, edited and removed here:
 * a label, a day (the year may be left out) and whether it comes back yearly.
 * A card (#422): each Occasion with when it comes next; Edit opens and removes them.
 */
export function OccasionsSection({ person }: { person: Person }) {
  const [editing, setEditing] = useState<Occasion | "new" | null>(null);
  const occasions = person.occasions ?? [];
  const today = todayStr();
  const next = new Map(upcomingOccasions([person], today, 364).map((u) => [u.occasionId, u]));
  return (
    <Section title="Occasions">
      <CardList>
        {occasions.length === 0 && <li className="text-muted-foreground px-3 py-2 text-sm">No occasions yet: a birthday, the day you met, a wedding.</li>}
        {occasions.map((o) => {
          const u = next.get(o.id);
          return (
            <CardRow
              key={o.id}
              icon={<CalendarHeart className="size-4" />}
              title={<span className="font-medium">{isBirthday(o) ? "🎂 " : ""}{o.label}</span>}
              sub={dotJoin([describeDay(o.day), o.yearly ? "every year" : "once", u && whenOf(u.inDays), u?.age != null && `turns ${u.age}`])}
              editLabel={`Edit ${o.label}: ${describeDay(o.day)}`}
              onEdit={() => setEditing(o)}
              removeLabel={`Remove ${o.label}`}
              onRemove={() => void removeWithUndo(o.label, () => removePart(person.id, "occasions", o.id), (r) => restorePart(person.id, "occasions", r))}
            />
          );
        })}
        <AddRow onClick={() => setEditing("new")}>Add occasion</AddRow>
      </CardList>
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
  const [draft, setDraft] = useState(() => occasionDraft(editing));
  const [labelError, setLabelError] = useState("");
  const [error, setError] = useState("");
  const set = (patch: Partial<OccasionDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const setDay = (day: string) => {
    set({ day });
    setError("");
  };

  async function save() {
    // Each problem under the field it is about (CODING_STANDARDS.md § Forms and feedback);
    // the repo checks again, and what else it refuses shows under the day.
    const input = occasionInput(draft);
    const labelProblem = occasionLabelProblem(input) ?? "";
    const dayProblem = occasionDayProblem(input) ?? "";
    setLabelError(labelProblem);
    setError(dayProblem);
    if (labelProblem || dayProblem) return;
    try {
      if (editing === "new") await addOccasion(personId, input);
      else await editOccasion(personId, editing.id, input);
      onClose();
    } catch (e) {
      setError(message(e));
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing === "new" ? "Add an occasion" : "Edit occasion"}</DialogTitle>
        <DialogDescription>A named day in their life. Birthday gives their age.</DialogDescription>
      </DialogHeader>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <Field label="Label" hint="Birthday, Met, Wedding… any word." error={labelError || undefined}>
          <Input
            value={draft.label}
            onChange={(e) => {
              set({ label: e.target.value });
              setLabelError("");
            }}
            placeholder="Birthday"
            autoFocus
          />
        </Field>
        {/* The boxes before their words, as a checkbox reads. */}
        <Field label="Every year" className="flex flex-row-reverse items-center justify-end gap-2">
          <Checkbox checked={draft.yearly} onCheckedChange={(c) => set({ yearly: c === true })} />
        </Field>
        {draft.yearly && (
          <Field label="I don't know the year" className="flex flex-row-reverse items-center justify-end gap-2">
            <Checkbox checked={draft.noYear} onCheckedChange={(c) => set({ noYear: c === true, day: dayWhenNoYear(draft.day, c === true) })} />
          </Field>
        )}
        {asksMonthDay(draft) ? (
          <MonthDayField value={draft.day.slice(-5)} onChange={setDay} error={error} />
        ) : (
          <Field label="Day" error={error || undefined}>
            <DatePicker value={pickerDay(draft.day)} onChange={setDay} required aria-label="Day" />
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

/**
 * A day of the year with no year ("03-04"): a month, then a day of it, 29 February included.
 * A problem shows under the one still to pick (the month while it is), marking it invalid and
 * read with it, as a Field's error is.
 */
function MonthDayField({ value, onChange, error }: { value: string; onChange: (day: string) => void; error: string }) {
  const [month = "", dayOfMonth = ""] = value.split("-");
  const dayOptions = Array.from({ length: daysIn(month) }, (_, i) => ({ value: String(i + 1).padStart(2, "0"), label: String(i + 1) }));
  const onMonth = error && !month ? error : undefined;
  return (
    <div className="grid min-w-0 grid-cols-2 items-start gap-3">
      <ChoiceField label="Month" value={month} options={MONTHS} error={onMonth} onCommit={(m) => onChange(monthDay(m, dayOfMonth))} />
      <ChoiceField label="Day" value={dayOfMonth} options={dayOptions} error={onMonth ? undefined : error || undefined} onCommit={(d) => onChange(monthDay(month, d))} />
    </div>
  );
}
