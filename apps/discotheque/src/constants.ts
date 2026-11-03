export const APP_ID = "discotheque";
export const APP_HREF = "/app/discotheque";
/** An album's page in the Discotheque (the Work page): a hidden routed screen, reached from the Gallery, a Playlist or the album's Peek. */
export const workHref = (id: string) => `${APP_HREF}/works/${id}`;
