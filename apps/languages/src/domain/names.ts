/** Two names the user would call the same: spaces around and case ignored — how a Topic, Deck or twin item is found by name. */
export function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
