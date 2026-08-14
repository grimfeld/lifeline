const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * PocketBase-compatible record id: 15 chars, lowercase alphanumeric.
 * Generated client-side so records keep one identity offline and on the
 * server (PocketBase accepts a caller-supplied id on create).
 */
export function newId(): string {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}
