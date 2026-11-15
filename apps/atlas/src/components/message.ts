/** What went wrong, in words: an Error's message, or whatever was thrown. */
export const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
