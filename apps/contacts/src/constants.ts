/** The People Module's home, where the Contacts App lands. */
export const PEOPLE_HREF = "/app/people";

/** A Person's page (ADR 0110's pattern): a hidden route, and the Peek's "Open". */
export const personHref = (id: string) => `/app/people/person/${id}`;
