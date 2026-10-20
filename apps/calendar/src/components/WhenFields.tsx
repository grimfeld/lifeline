import { useState } from "react";
import { Button, Checkbox, DatePicker, Field, TimeField, formatLength } from "@lifeline/ui";
import { describeEnd } from "@lifeline/core";
import { endDayPicked, lengthOf, withAllDay, withDate, withEnd, withStart, type WhenForm, type WhenFormErrors } from "../domain/eventForm";

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
 * moves the End with it, keeping the length. An End earlier than the Start
 * is the next day's (ADR 0090), and the readout names the end day whenever it
 * is another; "Ends another day" shows the end day's own picker, for anything
 * longer. All day asks for a first and a last day instead. Errors are
 * `whenFormErrors`'s, shown under their control. A one-off Time blocker
 * uses the same controls, without All day.
 */
export function WhenFields({
  value,
  onChange,
  errors = {},
  idPrefix = "ev-",
  canAllDay = true,
}: {
  value: WhenForm;
  onChange: (next: WhenForm) => void;
  errors?: WhenFormErrors;
  idPrefix?: string;
  /** Off for a one-off Time blocker: a band has hours (ADR 0090). */
  canAllDay?: boolean;
}) {
  const ids = whenIds(idPrefix);
  const set = (patch: Partial<WhenForm>) => onChange({ ...value, ...patch });
  const length = lengthOf(value);
  const readoutId = `${ids.end}-length`;
  const endsAnotherDay = !!value.endDate && value.endDate !== value.date;
  // The end day's picker: once asked for, or whenever the end day is not the one rolling gives.
  const [askedEndDay, setAskedEndDay] = useState(false);
  const showEndDay = askedEndDay || endDayPicked(value);
  return (
    <>
      {value.allDay ? (
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="First day" error={errors.date}>
            <DatePicker id={ids.date} required value={value.date} onChange={(date) => onChange(withDate(value, date))} />
          </Field>
          <Field label="Last day (optional)" error={errors.endDate}>
            <DatePicker id={ids.endDate} value={value.endDate} min={value.date || undefined} onChange={(endDate) => set({ endDate })} />
          </Field>
        </div>
      ) : (
        <div className="grid grid-cols-2 items-start gap-3">
          <Field label="Day" error={errors.date}>
            <DatePicker id={ids.date} required value={value.date} onChange={(date) => onChange(withDate(value, date))} />
          </Field>
          <Field label="Start" error={errors.start}>
            <TimeField id={ids.start} required value={value.start} onChange={(start) => onChange(withStart(value, start))} />
          </Field>
          <Field label="End" error={errors.end}>
            <TimeField id={ids.end} value={value.end} aria-describedby={length === null ? undefined : readoutId} onChange={(end) => onChange(withEnd(value, end))} />
          </Field>
          {length !== null ? (
            // Beside the End, level with its box (an End with an error has no length, so nothing hangs below it).
            <p id={readoutId} aria-live="polite" className="text-muted-foreground flex min-h-9 min-w-0 items-center self-end text-sm">
              {describeEnd({ date: value.date, endDate: endsAnotherDay ? value.endDate : value.date, end: value.end })} · {formatLength(length)}
            </p>
          ) : (
            <span />
          )}
          {showEndDay ? (
            <Field label="End day" error={errors.endDate}>
              <DatePicker id={ids.endDate} value={endsAnotherDay ? value.endDate : value.date} min={value.date || undefined} required onChange={(endDate) => set({ endDate: endDate === value.date ? "" : endDate })} />
            </Field>
          ) : (
            <Button type="button" variant="link" className="justify-self-start px-0" onClick={() => setAskedEndDay(true)}>
              Ends another day
            </Button>
          )}
        </div>
      )}
      {canAllDay && (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox id={ids.allDay} checked={value.allDay} onCheckedChange={(v) => onChange(withAllDay(value, !!v))} /> All day
        </label>
      )}
    </>
  );
}
