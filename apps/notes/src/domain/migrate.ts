import { NOTE, NOTES_FOLDER, type Note } from "./types";

/**
 * ADR 0046: which loose root Notes move into `Notes`, and what they become.
 * Pure so the rules that matter — leave topic folders alone, never collide a
 * title — are testable without a store.
 */
export function notesToMigrate(notes: Note[]): Note[] {
  const lower = (s: string) => s.trim().toLowerCase();
  // Titles are unique per folder for a type, so a name already in `Notes` is
  // the one case a move cannot make: that Note stays at the root.
  const taken = new Set(notes.filter((n) => n.type === NOTE && n.folder === NOTES_FOLDER).map((n) => lower(n.title)));
  const out: Note[] = [];
  for (const n of notes) {
    // Only Notes, only loose ones: `People/Paul` is the user's own filing.
    if (n.type !== NOTE || n.folder) continue;
    if (taken.has(lower(n.title))) continue;
    // Two root Notes differing only in case would collide with each other, not
    // just with what is already there.
    taken.add(lower(n.title));
    out.push({ ...n, folder: NOTES_FOLDER });
  }
  return out;
}
