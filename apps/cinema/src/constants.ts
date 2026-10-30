export const APP_ID = "cinema";
export const APP_HREF = "/app/cinema";
/** A work's page in the Cinema (the Work page): a hidden routed screen, reached from the Gallery, a Playlist or the work's Peek. */
export const workHref = (id: string) => `${APP_HREF}/works/${id}`;
