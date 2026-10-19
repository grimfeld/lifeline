/**
 * A back-logged "when it happened" (a `datetime-local` value, local time) as
 * the ISO instant a Completion stores. null when the field is empty or not a
 * time — `new Date("")` is Invalid Date, and `toISOString` on it throws.
 */
export function occurredAtOf(input: string): string | null {
  if (!input.trim()) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
