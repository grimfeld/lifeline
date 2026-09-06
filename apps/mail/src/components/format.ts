import type { Party } from "../domain/types";

/** A list date: the time today, the day this year, the full date otherwise. */
export function when(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  if (d.getFullYear() === now.getFullYear()) return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function whenFull(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Senders as the list shows them: first names, the last in full when several. */
export function senders(from: Party[], max = 3): string {
  if (from.length === 0) return "(unknown)";
  const short = (p: Party) => (p.name && p.name !== p.address ? p.name.split(/\s+/)[0] : p.address.split("@")[0]);
  if (from.length === 1) return from[0].name || from[0].address;
  const names = from.slice(-max).map(short);
  return (from.length > max ? "… " : "") + names.join(", ");
}

export function partyLine(p: Party): string {
  return p.name && p.name !== p.address ? `${p.name} <${p.address}>` : p.address;
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
