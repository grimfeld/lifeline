import { Checkbox, DatePicker, Field, Input } from "@lifeline/ui";
import type { EventForm, EventFormErrors } from "../domain/eventForm";

/** When an Event happens, as its form holds it. */
export type WhenForm = Omit<EventForm, "title">;

/** Each control's id under a prefix — the dialog's and a Peek's must not clash when one sits over the other. */
export const whenIds = (prefix: string) => ({
  date: `${prefix}date`,
  endDate: `${prefix}end-date`,
  start: `${prefix}start`,
  end: `${prefix}end`,
  allDay: `${prefix}all-day`,
});

/**
 * The day, last day, times and "All day" of an Event: the controls the Event
 * dialog and the Event's Peek (ADR 0085) both edit its guarded time Fields
 * with. Errors are `eventFormErrors`'s, shown under their control.
 */
export function EventWhenFields({
  value,
  onChange,
  errors = {},
  idPrefix = "ev-",
}: {
  value: WhenForm;
  onChange: (next: WhenForm) => void;
  errors?: EventFormErrors;
  idPrefix?: string;
}) {
  const ids = whenIds(idPrefix);
  const set = (patch: Partial<WhenForm>) => onChange({ ...value, ...patch });
  return (
    <>
      <div className="grid grid-cols-2 items-start gap-3">
        <Field label={value.allDay ? "First day" : "Day"} error={errors.date}>
          <DatePicker id={ids.date} required value={value.date} onChange={(date) => set({ date })} />
        </Field>
        {value.allDay ? (
          <Field label="Last day (optional)" error={errors.endDate}>
            <DatePicker id={ids.endDate} value={value.endDate} min={value.date || undefined} onChange={(endDate) => set({ endDate })} />
          </Field>
        ) : (
          <div className="grid grid-cols-2 items-start gap-2">
            <Field label="Start" error={errors.start}>
              <Input id={ids.start} type="time" value={value.start} onChange={(e) => set({ start: e.target.value })} />
            </Field>
            <Field label="End" error={errors.end}>
              <Input id={ids.end} type="time" value={value.end} onChange={(e) => set({ end: e.target.value })} />
            </Field>
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox id={ids.allDay} checked={value.allDay} onCheckedChange={(v) => set({ allDay: !!v })} /> All day
      </label>
    </>
  );
}
