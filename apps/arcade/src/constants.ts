export const APP_ID = "arcade";
export const APP_HREF = "/app/arcade";
/** A game's page in the Arcade (the Work page): a hidden routed screen, reached from the Gallery or the game's Peek. */
export const workHref = (id: string) => `${APP_HREF}/works/${id}`;
