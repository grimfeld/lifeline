/** What the Event dialog holds while it is being filled in. */
export interface EventForm {
  title: string;
  date: string;
  endDate: string;
  allDay: boolean;
  start: string;
  end: string;
}

/** The message under each field that is missing or wrong; empty when the event can be saved. */
export type EventFormErrors = Partial<Record<keyof Omit<EventForm, "allDay">, string>>;

export function eventFormErrors(f: EventForm): EventFormErrors {
  const errors: EventFormErrors = {};
  if (!f.title.trim()) errors.title = "Title required";
  if (!f.date) errors.date = "Day required";
  if (f.allDay) {
    if (f.date && f.endDate && f.endDate < f.date) errors.endDate = "End day must be after the first day";
  } else if (!f.start) errors.start = "Start time required";
  else if (f.end && f.end < f.start) errors.end = "End must be after start";
  return errors;
}

/** When an Event happens, its guarded Fields (ADR 0019). */
export interface EventWhen {
  date: string;
  endDate: string | null;
  start: string | null;
  end: string | null;
}

/** The form's day and times as the Event stores them: an all-day event has no times, a timed one a single day. */
export function whenOf(f: Omit<EventForm, "title">): EventWhen {
  return {
    date: f.date,
    endDate: f.allDay && f.endDate && f.endDate > f.date ? f.endDate : null,
    start: f.allDay ? null : f.start,
    end: f.allDay ? null : f.end || null,
  };
}
