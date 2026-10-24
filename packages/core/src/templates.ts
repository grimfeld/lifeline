import type { DateStr } from "./dates";

/** Fill a template's placeholders: {{title}}, {{date}} (YYYY-MM-DD), {{time}} (HH:MM). Unknown placeholders are left as-is. */
export function renderTemplate(text: string, vars: { title: string; date: DateStr; now?: Date }): string {
  const now = vars.now ?? new Date();
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const map: Record<string, string> = { title: vars.title, date: vars.date, time };
  return text.replace(/\{\{\s*([a-zA-Z]+)\s*\}\}/g, (m, key: string) => (key in map ? (map[key] ?? m) : m));
}
