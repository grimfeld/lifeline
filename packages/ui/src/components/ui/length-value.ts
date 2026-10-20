/**
 * A length is a span given in minutes: how long work, an Estimate or a
 * template takes (CONTEXT.md — an Event is given an end, work a length).
 */

/** 45 → "45m", 90 → "1h 30m", 3360 → "2d 8h": days from 24h up. */
export function formatLength(min: number): string {
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const parts = [d && `${d}d`, h && `${h}h`, m && `${m}m`].filter(Boolean);
  return parts.length ? parts.join(" ") : "0m";
}

const UNIT: Record<string, number> = { d: 1440, h: 60, m: 1 };

/**
 * Typed text as minutes: "90", "45m", "1h 30m", "1h30", "1.5h", "1:15",
 * "2d 8h", "3 hours 10 min". Each unit at most once, largest first; a bare
 * number after hours is minutes. Null for nothing, zero or nonsense.
 */
export function parseLength(text: string): number | null {
  const s = text
    .trim()
    .toLowerCase()
    .replace(/,/g, ".")
    .replace(/days?/g, "d")
    .replace(/(?:hours?|hrs?)/g, "h")
    .replace(/(?:minutes?|mins?)/g, "m")
    .replace(/\s+/g, "");
  if (!s) return null;
  const clock = /^(\d+):([0-5]\d)$/.exec(s);
  if (clock) return positive(Number(clock[1]) * 60 + Number(clock[2]));
  const m = /^(?:(\d+(?:\.\d+)?)d)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+)m?)?$/.exec(s);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  const total = Number(m[1] ?? 0) * UNIT.d + Number(m[2] ?? 0) * UNIT.h + Number(m[3] ?? 0) * UNIT.m;
  return positive(Math.round(total));
}

function positive(n: number): number | null {
  return Number.isFinite(n) && n > 0 ? n : null;
}
