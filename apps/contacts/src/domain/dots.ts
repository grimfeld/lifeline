/** Parts of a sub-line, joined by a middle dot; what is empty (or false) is left out. */
export const dotJoin = (parts: readonly (string | false | null | undefined)[]): string => parts.filter(Boolean).join(" · ");
