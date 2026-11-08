/**
 * A Person's parts (Occasions, Addresses, Contact details) are lists of
 * entries with an id, stored on the Person. Removing one and undoing it go
 * through these, so Undo puts back only the entry it took out, onto whatever
 * the list holds by then.
 */
export interface Part {
  id: string;
}

/** The list without the entry `id`, and where it stood (-1 when it was not there). */
export function takeOut<T extends Part>(list: readonly T[], id: string): { list: T[]; index: number } {
  return { list: list.filter((x) => x.id !== id), index: list.findIndex((x) => x.id === id) };
}

/** The entry back where it stood, or at the end when the list is shorter now; unchanged when it is already there. */
export function putBack<T extends Part>(list: readonly T[], entry: T, index: number): T[] {
  if (list.some((x) => x.id === entry.id)) return [...list];
  const at = index < 0 ? list.length : Math.min(index, list.length);
  return [...list.slice(0, at), entry, ...list.slice(at)];
}
