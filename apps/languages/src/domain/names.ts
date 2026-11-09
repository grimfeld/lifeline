/** A name as the user means it: spaces around and case ignored — the key a Topic, Deck or twin item is found by. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

/** Two names the user would call the same (`nameKey`). */
export function sameName(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}
