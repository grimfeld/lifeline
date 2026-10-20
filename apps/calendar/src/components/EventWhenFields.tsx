import { Checkbox, DatePicker, Field, TimeField, formatLength } from "@lifeline/ui";
import { formatTime } from "@lifeline/core";
import { lengthOf, withStart, type EventForm, type EventFormErrors } from "../domain/eventForm";

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
 * When an Event happens, the controls the Event dialog and the Event's Peek
 * (ADR 0085) both edit its guarded time Fields with. A timed Event is asked
 * the way people talk about meetings: a Start (its day and time) and an End,
 * with the length beside the End, shown and never asked; moving the Start
 * moves the End with it, keeping the length. All day asks for a first and a
 * last day instead. Errors are `eventFormErrors`'s, shown under their control.
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
  const length = lengthOf(value);
  const readoutId = `${ids.end}-length`;
  return (
    <>
      {value.allDay ? (
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="First day" error={errors.date}>
            <DatePicker id={ids.date} required value={value.date} onChange={(date) => set({ date })} />
          </Field>
          <Field label="Last day (optional)" error={errors.endDate}>
            <DatePicker id={ids.endDate} value={value.endDate} min={value.date || undefined} onChange={(endDate) => set({ endDate })} />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="Day" error={errors.date}>
            <DatePicker id={ids.date} required value={value.date} onChange={(date) => set({ date })} />
          </Field>
          <Field label="Start" error={errors.start}>
            <TimeField id={ids.start} required value={value.start} onChange={(start) => onChange(withStart(value, start))} />
          </Field>
          <Field label="End" error={errors.end}>
            <TimeField id={ids.end} value={value.end} aria-describedby={length === null ? undefined : readoutId} onChange={(end) => set({ end })} />
          </Field>
          {length !== null && (
            // Beside the End, level with its box (an End with an error has no length, so nothing hangs below it).
            <p id={readoutId} aria-live="polite" className="text-muted-foreground flex min-h-9 min-w-0 items-center self-end text-sm">
              until {formatTime(value.end)} · {formatLength(length)}
            </p>
          )}
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <Checkbox id={ids.allDay} checked={value.allDay} onCheckedChange={(v) => set({ allDay: !!v })} /> All day
      </label>
    </>
  );
}
