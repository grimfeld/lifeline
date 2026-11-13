/** Parts of a sub-line, joined by a middle dot; what is empty (or false) is left out. */
export const dotJoin = (parts: readonly (string | false | null | undefined)[]): string => parts.filter(Boolean).join(" · ");

/** A date or "YYYY-MM" month as its month's name, in the browser's language (long with the year, or short). */
export const monthLabel = (dayOrMonth: string, options: Intl.DateTimeFormatOptions): string => new Date(`${dayOrMonth.slice(0, 7)}-15T12:00:00`).toLocaleDateString(undefined, options);
