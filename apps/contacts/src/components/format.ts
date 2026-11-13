/** How the People pages write dates: presentation, in the browser's language, kept out of the domain. */

/** A date or "YYYY-MM" month as its month's name, in the browser's language (long with the year, or short). */
export const monthLabel = (dayOrMonth: string, options: Intl.DateTimeFormatOptions): string => new Date(`${dayOrMonth.slice(0, 7)}-15T12:00:00`).toLocaleDateString(undefined, options);
