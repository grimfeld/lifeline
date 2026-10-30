export const APP_ID = "library";
export const APP_HREF = "/app/library";
/** The Author's page in the Library (ADR 0052): a hidden routed screen, reached from any byline. */
export const authorHref = (id: string) => `${APP_HREF}/authors/${id}`;
/** A work's page in the Library (the Work page): a hidden routed screen, reached from the Gallery, a byline's Author page or the work's Peek. */
export const workHref = (id: string) => `${APP_HREF}/works/${id}`;
