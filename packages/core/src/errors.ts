/** What went wrong, in words: an Error's message, or whatever was thrown. */
export const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));
