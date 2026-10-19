/**
 * How a Combobox matches what was typed (ADR 0079): case- and
 * accent-insensitive, spaces collapsed — the way Wikilinks resolve
 * (CONTEXT.md "Wikilink"). Pure; the Combobox and its tests share it.
 */

/** One choice in a Combobox: `label` is what is shown and matched, `keywords` match too (aliases). */
export interface ComboboxMatchable {
  value: string;
  label: string;
  keywords?: string[];
}

/** Letters NFD leaves whole but people type without their stroke (Stanisław → stanislaw). */
const FOLD: Record<string, string> = { ł: "l", ø: "o", đ: "d", ħ: "h", ı: "i", ß: "ss", æ: "ae", œ: "oe", þ: "th" };

/** The key two names compare by: decomposed, marks stripped, lower-cased, spaces collapsed. */
export function comboboxKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[łøđħıßæœþ]/g, (c) => FOLD[c] ?? c)
    .trim()
    .replace(/\s+/g, " ");
}

const keysOf = (o: ComboboxMatchable) => [o.label, ...(o.keywords ?? [])].map(comboboxKey);

/**
 * The options that answer to the query, best first: a name that starts with
 * it before one that only contains it, otherwise in the given order. An
 * empty query keeps every option.
 */
export function matchOptions<T extends ComboboxMatchable>(options: readonly T[], query: string): T[] {
  const q = comboboxKey(query);
  if (!q) return [...options];
  const starts: T[] = [];
  const contains: T[] = [];
  for (const o of options) {
    const keys = keysOf(o);
    if (keys.some((k) => k.startsWith(q))) starts.push(o);
    else if (keys.some((k) => k.includes(q))) contains.push(o);
  }
  return [...starts, ...contains];
}

/** Whether to offer "Create …": something was typed and no option (label or keyword) is exactly it. */
export function offersCreate(options: readonly ComboboxMatchable[], query: string): boolean {
  const q = comboboxKey(query);
  return q !== "" && !options.some((o) => keysOf(o).includes(q));
}
