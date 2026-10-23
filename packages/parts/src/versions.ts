/**
 * The Version type's id (CONTEXT.md, Version): a deliberate snapshot of an
 * Essay's or a Chapter's body. The Writer owns and registers the type; the
 * id is shared so the Manuscript can take a Chapter's Versions with it on
 * delete without importing the Writer (ADR 0100). It predates the split and stays.
 */
export const VERSION = "writing_version";
