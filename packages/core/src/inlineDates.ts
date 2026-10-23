import { addDays, clampedDate, daysInMonth, fromParts, parts, startOfWeek, weekdayOf, type DateStr } from "./dates";
import type { InlineDateReader, InlineDateReading } from "./inline";

/**
 * The `/` mark's reader (ADR 0091): the words after `/` read as a day, a time,
 * or both, in every language it has a table for. The rules are one set; each
 * language is only its words (`DateVocabulary`), so another language is
 * another table. A word two languages give different meanings (`mar`: March,
 * mardi) takes the preferred language's; a word only one language knows is
 * read in that one, whatever the preference.
 *
 * What it reads, in any language's words:
 * - a day near today (`tomorrow`, `après-demain`), a weekday (the coming one,
 *   never today; "next" and "prochain" change nothing), `in 3 days`,
 *   `next week` / `mois prochain` (their first day), an ISO `2026-11-02`, a
 *   day and a month in either order with an optional year (the coming one
 *   when none is given), or a month alone (its first day);
 * - then, optionally after `at` / `à`, a time: `17:30`, `5pm`, `9 am`, `9h30`,
 *   `noon` — or a time alone.
 *
 * It reads as far as the words make a date and stops there, so the rest of
 * the line stays content. Out come the `YYYY-MM-DD` / `HH:MM` forms argument
 * reading already accepts. Pure: today is given.
 */

export interface DateVocabulary {
  /** The language's own name, for the setting. */
  name: string;
  /** Days counted from today: `{ tomorrow: 1 }`. An entry may be several words. */
  relative: Record<string, number>;
  /** Sunday first; each day's words, its full name first. */
  weekdays: string[][];
  /** Sunday first, how a reading names the day. */
  weekdayLabels: string[];
  /** January first; each month's words, its full name first. */
  months: string[][];
  monthLabels: string[];
  /** Words for "the coming one", before (`next fri`) or after (`lundi prochain`) the weekday or unit. */
  next: { before: string[]; after: string[] };
  /** The word before a count of units: `in`, `dans`. */
  in: string[];
  units: { day: string[]; week: string[]; month: string[]; year: string[] };
  /** What may follow a day of the month: `24th`, `1er`. */
  ordinals: string[];
  /** The word between a day and its time: `at`, `à`. */
  at: string[];
  am: string[];
  pm: string[];
  /** What marks an hour, with its minutes after it: `9h30`. */
  hour: string[];
  /** Times by name: `{ noon: "12:00" }`. */
  clock: Record<string, string>;
}

const EN: DateVocabulary = {
  name: "English",
  relative: { today: 0, tomorrow: 1, "day after tomorrow": 2, yesterday: -1 },
  weekdays: [
    ["sunday", "sun"],
    ["monday", "mon"],
    ["tuesday", "tue", "tues"],
    ["wednesday", "wed"],
    ["thursday", "thu", "thur", "thurs"],
    ["friday", "fri"],
    ["saturday", "sat"],
  ],
  weekdayLabels: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  months: [
    ["january", "jan"],
    ["february", "feb"],
    ["march", "mar"],
    ["april", "apr"],
    ["may"],
    ["june", "jun"],
    ["july", "jul"],
    ["august", "aug"],
    ["september", "sep", "sept"],
    ["october", "oct"],
    ["november", "nov"],
    ["december", "dec"],
  ],
  monthLabels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  next: { before: ["next"], after: [] },
  in: ["in"],
  units: { day: ["day", "days"], week: ["week", "weeks"], month: ["month", "months"], year: ["year", "years"] },
  ordinals: ["st", "nd", "rd", "th"],
  at: ["at"],
  am: ["am"],
  pm: ["pm"],
  hour: [],
  clock: { noon: "12:00", midnight: "00:00" },
};

const FR: DateVocabulary = {
  name: "Français",
  relative: { "aujourd'hui": 0, auj: 0, demain: 1, "après-demain": 2, hier: -1 },
  weekdays: [
    ["dimanche", "dim"],
    ["lundi", "lun"],
    ["mardi", "mar"],
    ["mercredi", "mer"],
    ["jeudi", "jeu"],
    ["vendredi", "ven"],
    ["samedi", "sam"],
  ],
  weekdayLabels: ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"],
  months: [
    ["janvier", "janv", "jan"],
    ["février", "févr", "fév"],
    ["mars"],
    ["avril", "avr"],
    ["mai"],
    ["juin"],
    ["juillet", "juil"],
    ["août"],
    ["septembre", "sept"],
    ["octobre", "oct"],
    ["novembre", "nov"],
    ["décembre", "déc"],
  ],
  monthLabels: ["janv", "févr", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"],
  next: { before: [], after: ["prochain", "prochaine"] },
  in: ["dans"],
  units: { day: ["jour", "jours"], week: ["semaine", "semaines"], month: ["mois"], year: ["an", "ans", "année", "années"] },
  ordinals: ["er", "e"],
  at: ["à"],
  am: [],
  pm: [],
  hour: ["h"],
  clock: { midi: "12:00", minuit: "00:00" },
};

/** Every language `/` reads, by code. */
export const DATE_VOCABULARIES: Readonly<Record<string, DateVocabulary>> = { en: EN, fr: FR };

export interface DateReaderOptions {
  today: DateStr;
  /** The language whose meaning wins when two disagree on a word. */
  prefer: string;
  /** The tables to read with; every language in them is always understood. */
  vocabularies?: Readonly<Record<string, DateVocabulary>>;
}

// ── Words ─────────────────────────────────────────────────────────────────

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/’/g, "'");

interface Word {
  text: string;
  end: number;
}

type Unit = keyof DateVocabulary["units"];

/** What a phrase may mean. */
type Meaning =
  | { kind: "relative"; days: number }
  | { kind: "weekday"; day: number }
  | { kind: "month"; month: number }
  | { kind: "unit"; unit: Unit }
  | { kind: "next"; after: boolean }
  | { kind: "in" }
  | { kind: "at" }
  | { kind: "am" }
  | { kind: "pm" }
  | { kind: "clock"; time: string };

interface Entry {
  words: string[];
  meaning: Meaning;
}

function entriesOf(v: DateVocabulary): Entry[] {
  const out: Entry[] = [];
  const add = (phrases: readonly string[], meaning: Meaning) => phrases.forEach((p) => out.push({ words: fold(p).split(/\s+/), meaning }));
  for (const [p, days] of Object.entries(v.relative)) add([p], { kind: "relative", days });
  v.weekdays.forEach((ws, day) => add(ws, { kind: "weekday", day }));
  v.months.forEach((ws, month) => add(ws, { kind: "month", month: month + 1 }));
  for (const unit of Object.keys(v.units) as Unit[]) add(v.units[unit], { kind: "unit", unit });
  add(v.next.before, { kind: "next", after: false });
  add(v.next.after, { kind: "next", after: true });
  add(v.in, { kind: "in" });
  add(v.at, { kind: "at" });
  add(v.am, { kind: "am" });
  add(v.pm, { kind: "pm" });
  for (const [p, time] of Object.entries(v.clock)) add([p], { kind: "clock", time });
  return out;
}

interface Match {
  meanings: Meaning[];
  lang: string;
  /** Index of the word after the phrase. */
  next: number;
}

// ── The reader ────────────────────────────────────────────────────────────

export function dateReader({ today, prefer, vocabularies = DATE_VOCABULARIES }: DateReaderOptions): InlineDateReader {
  const langs = Object.keys(vocabularies);
  const entries = new Map(Object.entries(vocabularies).map(([l, v]) => [l, entriesOf(v)]));
  const ordinals = [...new Set(Object.values(vocabularies).flatMap((v) => v.ordinals.map(fold)))];
  const hourMarks = [...new Set(Object.values(vocabularies).flatMap((v) => v.hour.map(fold)))];
  const ordered = (first: string) => [first, ...langs.filter((l) => l !== first)].filter((l) => entries.has(l));

  /**
   * The phrase at word `i`: the longest any language makes there, its
   * meanings taken from the first language in `order` that knows it.
   */
  function phrase(words: Word[], i: number, order: string[]): Match | undefined {
    let best: Match | undefined;
    for (const lang of order) {
      for (const e of entries.get(lang)!) {
        const n = e.words.length;
        if (i + n > words.length || !e.words.every((w, k) => fold(words[i + k]!.text) === w)) continue;
        if (!best || i + n > best.next) best = { meanings: [e.meaning], lang, next: i + n };
        else if (best.lang === lang && i + n === best.next) best.meanings.push(e.meaning);
      }
    }
    return best;
  }
  const has = (m: Match | undefined, kind: Meaning["kind"]) => m?.meanings.find((x) => x.kind === kind);

  /** The coming `weekday`, never today. */
  const coming = (day: number) => addDays(today, ((day - weekdayOf(today) + 6) % 7) + 1);
  const nextOf = (unit: Unit): DateStr => {
    const { y, m } = parts(today);
    if (unit === "day") return addDays(today, 1);
    if (unit === "week") return addDays(startOfWeek(today), 7);
    if (unit === "month") return fromParts(y, m + 1, 1);
    return fromParts(y + 1, 1, 1);
  };
  const plus = (n: number, unit: Unit): DateStr => {
    const { y, m, day } = parts(today);
    if (unit === "day") return addDays(today, n);
    if (unit === "week") return addDays(today, 7 * n);
    if (unit === "month") return clampedDate(y, m + n, day);
    return clampedDate(y + n, m, day);
  };
  /** A day of a month, this year's when it is still ahead, unless the year is given. */
  const dayOf = (month: number, day: number, year?: number): DateStr | undefined => {
    const y = year ?? parts(today).y;
    if (day < 1 || day > daysInMonth(y, month)) return undefined;
    const d = fromParts(y, month, day);
    if (year !== undefined || d >= today) return d;
    return day <= daysInMonth(y + 1, month) ? fromParts(y + 1, month, day) : undefined;
  };

  const dayNumber = (w: Word | undefined): number | undefined => {
    if (!w) return undefined;
    const m = /^(\d{1,2})(\p{L}*)$/u.exec(fold(w.text));
    if (!m || (m[2] && !ordinals.includes(m[2]))) return undefined;
    return Number(m[1]);
  };
  const yearNumber = (w: Word | undefined) => (w && /^\d{4}$/.test(w.text) ? Number(w.text) : undefined);

  interface Got {
    value: string;
    next: number;
    lang?: string;
  }

  function readDay(words: Word[], i: number, order: string[]): Got | undefined {
    const w = words[i];
    if (!w) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(w.text)) {
      const { y, m, day } = parts(w.text);
      return m >= 1 && m <= 12 && day >= 1 && day <= daysInMonth(y, m) ? { value: w.text, next: i + 1 } : undefined;
    }
    // A day of the month, then the month: `24 oct`, `1er novembre 2027`.
    const n = dayNumber(w);
    if (n !== undefined) {
      const month = phrase(words, i + 1, order);
      const mm = has(month, "month");
      if (!month || !mm || mm.kind !== "month") return undefined;
      const year = yearNumber(words[month.next]);
      const d = dayOf(mm.month, n, year);
      return d ? { value: d, next: month.next + (year === undefined ? 0 : 1), lang: month.lang } : undefined;
    }
    const p = phrase(words, i, order);
    if (!p) return undefined;
    for (const m of p.meanings) {
      if (m.kind === "relative") return { value: addDays(today, m.days), next: p.next, lang: p.lang };
      if (m.kind === "weekday") {
        const after = phrase(words, p.next, order);
        return { value: coming(m.day), next: has(after, "next") ? after!.next : p.next, lang: p.lang };
      }
      if (m.kind === "month") {
        // `oct 24 [2027]`, or the month alone: its first day.
        const day = dayNumber(words[p.next]);
        if (day !== undefined) {
          const year = yearNumber(words[p.next + 1]);
          const d = dayOf(m.month, day, year);
          if (d) return { value: d, next: p.next + 1 + (year === undefined ? 0 : 1), lang: p.lang };
        }
        const d = dayOf(m.month, 1);
        if (d) return { value: d, next: p.next, lang: p.lang };
      }
      if (m.kind === "unit") {
        const after = phrase(words, p.next, order);
        if (has(after, "next")) return { value: nextOf(m.unit), next: after!.next, lang: p.lang };
      }
      if (m.kind === "next" && !m.after) {
        const what = phrase(words, p.next, order);
        const wd = has(what, "weekday");
        if (wd?.kind === "weekday") return { value: coming(wd.day), next: what!.next, lang: what!.lang };
        const unit = has(what, "unit");
        if (unit?.kind === "unit") return { value: nextOf(unit.unit), next: what!.next, lang: what!.lang };
      }
      if (m.kind === "in") {
        const at = words[p.next];
        const count = at && /^\d{1,3}$/.test(at.text) ? Number(at.text) : undefined;
        const unit = count === undefined ? undefined : phrase(words, p.next + 1, order);
        const u = has(unit, "unit");
        if (u?.kind === "unit") return { value: plus(count!, u.unit), next: unit!.next, lang: p.lang };
      }
    }
    return undefined;
  }

  const clock = (h: number, min: number) => (h > 23 || min > 59 ? undefined : `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`);
  const meridiem = (h: number, min: number, pm: boolean) => (h < 1 || h > 12 ? undefined : clock((h % 12) + (pm ? 12 : 0), min));

  function readTime(words: Word[], i: number, order: string[]): Got | undefined {
    const w = words[i];
    if (!w) return undefined;
    const named = phrase(words, i, order);
    const c = has(named, "clock");
    if (c?.kind === "clock") return { value: c.time, next: named!.next };
    const m = /^(\d{1,2})(?::(\d{2}))?(\p{L}*)(\d{2})?$/u.exec(fold(w.text));
    if (!m) return undefined;
    const h = Number(m[1]);
    const colon = m[2] !== undefined ? Number(m[2]) : undefined;
    const suffix = m[3];
    if (suffix) {
      if (hourMarks.includes(suffix)) return colon === undefined ? wrap(clock(h, Number(m[4] ?? 0)), i + 1) : undefined;
      if (m[4] !== undefined) return undefined;
      const s = phrase([{ text: suffix, end: 0 }], 0, order);
      if (has(s, "am")) return wrap(meridiem(h, colon ?? 0, false), i + 1);
      if (has(s, "pm")) return wrap(meridiem(h, colon ?? 0, true), i + 1);
      return undefined;
    }
    if (m[4] !== undefined) return undefined;
    // `9 am`: the meridiem as a word of its own.
    const after = phrase(words, i + 1, order);
    if (has(after, "am")) return wrap(meridiem(h, colon ?? 0, false), after!.next);
    if (has(after, "pm")) return wrap(meridiem(h, colon ?? 0, true), after!.next);
    // A bare number is no time: `/fri 5 apples`.
    return colon === undefined ? undefined : wrap(clock(h, colon), i + 1);
  }
  const wrap = (value: string | undefined, next: number): Got | undefined => (value ? { value, next } : undefined);

  function label(date: string | undefined, time: string | undefined, lang: string): string {
    const v = vocabularies[lang];
    if (!v) return "";
    const out: string[] = [];
    if (date) {
      const { y, m, day } = parts(date);
      // A weekday is 0–6 and a month 1–12: both labels are there.
      out.push(v.weekdayLabels[weekdayOf(date)]!, String(day), v.monthLabels[m - 1]!);
      if (y !== parts(today).y) out.push(String(y));
    }
    if (time) out.push(time);
    return out.join(" ");
  }

  function readWith(rest: string, order: string[]): InlineDateReading | undefined {
    const words: Word[] = [];
    for (const m of rest.matchAll(/\S+/g)) words.push({ text: m[0], end: m.index! + m[0].length });
    // A space after `/` is no date: the mark needs its word.
    if (!words.length || /^\s/.test(rest)) return undefined;
    let i = 0;
    const day = readDay(words, i, order);
    if (day) i = day.next;
    let time: Got | undefined;
    const at = phrase(words, i, order);
    if (day && has(at, "at")) time = readTime(words, at!.next, order);
    time ??= readTime(words, i, order);
    if (time) i = time.next;
    let date = day;
    if (!day && time) {
      // `5pm fri`, the time first.
      date = readDay(words, i, order);
      if (date) i = date.next;
    }
    if (!date && !time) return undefined;
    return { date: date?.value, time: time?.value, length: words[i - 1]!.end, label: label(date?.value, time?.value, date?.lang ?? order[0] ?? prefer) };
  }

  const preferred = ordered(prefer);

  return {
    read: (rest) => readWith(rest, preferred),
    suggest(partial) {
      const q = fold(partial);
      if (!q) return [];
      const seen = new Set<string>();
      const out: { insert: string; label: string }[] = [];
      for (const lang of preferred) {
        const v = vocabularies[lang];
        if (!v) continue;
        const groups = [...Object.keys(v.relative).map((p) => [p]), ...v.weekdays, ...v.months, ...Object.keys(v.clock).map((p) => [p])];
        for (const group of groups) {
          // The word as typed when the group has it, else the first it begins (`ve` → vendredi).
          const word = group.find((w) => fold(w) === q) ?? group.find((w) => fold(w).startsWith(q));
          if (!word) continue;
          const r = readWith(word, ordered(lang));
          const key = `${r?.date}|${r?.time}`;
          if (!r || r.length !== word.length || seen.has(key)) continue;
          seen.add(key);
          out.push({ insert: word, label: `${word} · ${r.label}` });
        }
      }
      return out.slice(0, 8);
    },
  };
}
