import { documentsOf, putDocument } from "@lifeline/core";
import { NOTE, type Note } from "../domain/types";
import { notesToMigrate } from "../domain/migrate";

const DONE_KEY = "lifeline.notes.rootMigrated";

/**
 * ADR 0046: `note` gained `Notes` as its home Folder, so the Notes that were
 * sitting loose at the root move into it. Notes already filed in a topic
 * folder (`People/Paul`) are the user's own organisation and are left alone.
 *
 * Deliberately **not** `moveDocument`: a root Document's path *is* its title,
 * so that function's path-form rewrite would turn every `[[Paul]]` in the vault
 * into `[[Notes/Paul]]` — rewriting the name-form links ADR 0013 promises never
 * to touch. Writing the folder is the whole move; `[[Paul]]` keeps resolving by
 * unique title from its new home.
 *
 * Runs once per device (the flag is local; the moves themselves sync), and is
 * safe to run again: a second pass finds nothing at the root to move.
 */
export async function migrateRootNotes(): Promise<void> {
  try {
    if (localStorage.getItem(DONE_KEY)) return;
  } catch {
    // A browser refusing storage gets the migration every launch; it is idempotent.
  }
  const notes = await documentsOf<Note>(NOTE);
  for (const n of notesToMigrate(notes)) await putDocument<Note>(n);
  try {
    localStorage.setItem(DONE_KEY, "1");
  } catch {
    /* nothing to remember on; see above */
  }
}
