/**
 * The Field values the generic editor's form has typed but the stored
 * Document has not caught up with yet. The form shows them over the stored
 * values, so a controlled input does not snap back to the old value for the
 * length of the save's debounce and round trip (typing used to lose keys).
 */
export type FieldDraft = Record<string, unknown>;

function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  // Empty and absent are the same value to a form control.
  const blank = (v: unknown) => v === undefined || v === null || v === "";
  if (blank(a) && blank(b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Drops the drafted keys the Document now holds. Returns the same object
 * when nothing settled, so a state setter can bail out of a re-render.
 */
export function settleDraft(draft: FieldDraft, doc: Record<string, unknown>): FieldDraft {
  let out: FieldDraft | null = null;
  for (const key of Object.keys(draft)) {
    if (!same(draft[key], doc[key])) continue;
    out ??= { ...draft };
    delete out[key];
  }
  return out ?? draft;
}

/** The form's values: the stored Fields with the draft over them. */
export function draftedValues(fields: { key: string }[], doc: Record<string, unknown>, draft: FieldDraft): FieldDraft {
  const out: FieldDraft = {};
  for (const f of fields) out[f.key] = f.key in draft ? draft[f.key] : doc[f.key];
  return out;
}
