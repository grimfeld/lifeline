export const APP_ID = "library";
export const APP_HREF = "/app/library";
/** The Author's page in the Library (ADR 0052): a hidden routed screen, reached from any byline. */
export const authorHref = (id: string) => `${APP_HREF}/authors/${id}`;
