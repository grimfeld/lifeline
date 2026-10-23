import { describe, expect, it } from "vitest";
import { DATE_VOCABULARIES, dateReader, type DateVocabulary } from "./inlineDates";
import { readInlineLine, type InlineCommand } from "./inline";

// Wednesday 21 October 2026.
const TODAY = "2026-10-21";
const en = dateReader({ today: TODAY, prefer: "en" });
const fr = dateReader({ today: TODAY, prefer: "fr" });

/** What `/rest` reads as, without the label. */
const at = (reader: typeof en, rest: string) => {
  const r = reader.read(rest);
  return r && { date: r.date, time: r.time, length: r.length };
};

describe("English dates and times", () => {
  it("reads days relative to today", () => {
    expect(at(en, "today")).toEqual({ date: "2026-10-21", time: undefined, length: 5 });
    expect(en.read("tomorrow")?.date).toBe("2026-10-22");
    expect(en.read("yesterday")?.date).toBe("2026-10-20");
    expect(en.read("day after tomorrow")).toMatchObject({ date: "2026-10-23", length: 18 });
  });

  it("reads a weekday as the coming one, never today, and next as the same", () => {
    expect(en.read("fri")?.date).toBe("2026-10-23");
    expect(en.read("friday")?.date).toBe("2026-10-23");
    expect(en.read("wed")?.date).toBe("2026-10-28");
    expect(en.read("next fri")).toMatchObject({ date: "2026-10-23", length: 8 });
    expect(en.read("mon")?.date).toBe("2026-10-26");
  });

  it("reads in N days, weeks, months", () => {
    expect(en.read("in 3 days")).toMatchObject({ date: "2026-10-24", length: 9 });
    expect(en.read("in 1 day")?.date).toBe("2026-10-22");
    expect(en.read("in 2 weeks")?.date).toBe("2026-11-04");
    expect(en.read("in 1 month")?.date).toBe("2026-11-21");
  });

  it("reads next week and next month as their first day", () => {
    expect(en.read("next week")?.date).toBe("2026-10-26");
    expect(en.read("next month")?.date).toBe("2026-11-01");
  });

  it("reads an ISO date and day-month dates, in the coming year when no year is given", () => {
    expect(at(en, "2026-11-02")).toEqual({ date: "2026-11-02", time: undefined, length: 10 });
    expect(en.read("24 oct")?.date).toBe("2026-10-24");
    expect(en.read("oct 24")?.date).toBe("2026-10-24");
    expect(en.read("october 24th")?.date).toBe("2026-10-24");
    expect(en.read("2 nov 2027")).toMatchObject({ date: "2027-11-02", length: 10 });
    expect(en.read("20 oct")?.date).toBe("2027-10-20");
    expect(en.read("31 feb")).toBeUndefined();
  });

  it("reads times, alone or after a day", () => {
    expect(at(en, "5pm")).toEqual({ date: undefined, time: "17:00", length: 3 });
    expect(en.read("17:30")?.time).toBe("17:30");
    expect(en.read("9:15am")?.time).toBe("09:15");
    expect(en.read("12am")?.time).toBe("00:00");
    expect(en.read("12pm")?.time).toBe("12:00");
    expect(en.read("noon")?.time).toBe("12:00");
    expect(at(en, "fri 5pm")).toEqual({ date: "2026-10-23", time: "17:00", length: 7 });
    expect(at(en, "tomorrow at 9 am")).toEqual({ date: "2026-10-22", time: "09:00", length: 16 });
    expect(en.read("13pm")).toBeUndefined();
    expect(en.read("25:00")).toBeUndefined();
  });

  it("stops where the date ends, so the rest of the line stays the line's", () => {
    expect(en.read("fri call mum")?.length).toBe(3);
    expect(en.read("fri 5 apples")?.length).toBe(3);
    expect(en.read("tomorrow at home")?.length).toBe(8);
    expect(en.read("fridge")).toBeUndefined();
    expect(en.read("5")).toBeUndefined();
  });

  it("labels the reading taken", () => {
    expect(en.read("fri 5pm")?.label).toBe("Fri 23 Oct 17:00");
    expect(en.read("2 nov 2027")?.label).toBe("Tue 2 Nov 2027");
  });
});

describe("French dates and times", () => {
  it("reads days relative to today, accents or not", () => {
    expect(fr.read("aujourd'hui")?.date).toBe("2026-10-21");
    expect(fr.read("demain")?.date).toBe("2026-10-22");
    expect(fr.read("après-demain")?.date).toBe("2026-10-23");
    expect(fr.read("apres-demain")?.date).toBe("2026-10-23");
    expect(fr.read("hier")?.date).toBe("2026-10-20");
  });

  it("reads weekdays, prochain after them", () => {
    expect(fr.read("ven")?.date).toBe("2026-10-23");
    expect(fr.read("vendredi")?.date).toBe("2026-10-23");
    expect(fr.read("lundi prochain")).toMatchObject({ date: "2026-10-26", length: 14 });
    expect(fr.read("semaine prochaine")?.date).toBe("2026-10-26");
    expect(fr.read("mois prochain")?.date).toBe("2026-11-01");
  });

  it("reads dans N jours, semaines", () => {
    expect(fr.read("dans 3 jours")).toMatchObject({ date: "2026-10-24", length: 12 });
    expect(fr.read("dans 2 semaines")?.date).toBe("2026-11-04");
  });

  it("reads day-month dates", () => {
    expect(fr.read("24 octobre")?.date).toBe("2026-10-24");
    expect(fr.read("1er novembre")?.date).toBe("2026-11-01");
    expect(fr.read("2 déc 2027")?.date).toBe("2027-12-02");
  });

  it("reads hours with h", () => {
    expect(at(fr, "ven 9h")).toEqual({ date: "2026-10-23", time: "09:00", length: 6 });
    expect(fr.read("9h30")?.time).toBe("09:30");
    expect(fr.read("17h")?.time).toBe("17:00");
    expect(fr.read("demain à 8h")).toMatchObject({ date: "2026-10-22", time: "08:00", length: 11 });
    expect(fr.read("midi")?.time).toBe("12:00");
  });

  it("labels the reading in French", () => {
    expect(fr.read("ven 9h")?.label).toBe("ven 23 oct 09:00");
  });
});

describe("both languages, a preference for collisions", () => {
  it("always understands both languages", () => {
    expect(en.read("demain")?.date).toBe("2026-10-22");
    expect(en.read("ven 9h")?.time).toBe("09:00");
    expect(fr.read("tomorrow")?.date).toBe("2026-10-22");
    expect(fr.read("fri 5pm")?.time).toBe("17:00");
  });

  it("reads mar as March in English and as Tuesday in French", () => {
    expect(en.read("mar")).toMatchObject({ date: "2027-03-01", label: "Mon 1 Mar 2027" });
    expect(en.read("mar 3")?.date).toBe("2027-03-03");
    expect(fr.read("mar")).toMatchObject({ date: "2026-10-27", label: "mar 27 oct" });
    expect(fr.read("mar 3")).toMatchObject({ date: "2026-10-27", length: 3 });
  });

  it("leaves a word only one language knows to that language, whatever the preference", () => {
    expect(fr.read("march")?.date).toBe("2027-03-01");
    expect(en.read("mardi")?.date).toBe("2026-10-27");
  });
});

describe("suggestions as typed", () => {
  it("suggests the readings of the words begun", () => {
    const [first] = fr.suggest("ve");
    expect(first).toEqual({ insert: "vendredi", label: "vendredi · ven 23 oct" });
    expect(en.suggest("to").map((s) => s.insert)).toEqual(["today", "tomorrow"]);
  });

  it("puts the preferred language's reading first, one row per reading", () => {
    expect(en.suggest("ma").map((s) => s.insert)).toEqual(["march", "may", "mardi"]);
    expect(fr.suggest("ma").map((s) => s.insert)).toEqual(["mardi", "mars", "mai"]);
  });

  it("suggests nothing for what no word begins with", () => {
    expect(en.suggest("zz")).toEqual([]);
  });
});

describe("a new language is a new table", () => {
  const de: DateVocabulary = {
    ...DATE_VOCABULARIES.en!,
    name: "Deutsch",
    relative: { heute: 0, morgen: 1, übermorgen: 2, gestern: -1 },
    weekdays: [["sonntag", "so"], ["montag", "mo"], ["dienstag", "di"], ["mittwoch", "mi"], ["donnerstag", "do"], ["freitag", "fr"], ["samstag", "sa"]],
    weekdayLabels: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
    next: { before: ["nächsten", "nächste"], after: [] },
    in: ["in"],
    units: { day: ["tag", "tagen"], week: ["woche", "wochen"], month: ["monat", "monaten"], year: ["jahr", "jahren"] },
    at: ["um"],
    am: [],
    pm: [],
    hour: ["uhr"],
    clock: { mittag: "12:00", mitternacht: "00:00" },
  };
  const reader = dateReader({ today: TODAY, prefer: "de", vocabularies: { ...DATE_VOCABULARIES, de } });

  it("reads it with the same rules", () => {
    expect(at(reader, "freitag um 17uhr")).toEqual({ date: "2026-10-23", time: "17:00", length: 16 });
    expect(reader.read("in 3 tagen")?.date).toBe("2026-10-24");
    expect(reader.read("nächste woche")?.date).toBe("2026-10-26");
    expect(reader.read("demain")?.date).toBe("2026-10-22");
  });
});

describe("in the inline line", () => {
  const EVENT: InlineCommand = {
    appId: "calendar",
    id: "calendar.add-event",
    title: "Add event",
    args: [
      { key: "title", label: "Title", kind: "text", required: true },
      { key: "date", label: "Date", kind: "date" },
      { key: "start", label: "Start", kind: "time" },
    ],
    invoke: async () => ({ message: "done" }),
  };

  it("fills the date and time arguments and previews the reading", () => {
    const r = readInlineLine({ line: "!event dinner /ven 9h with Ana", commands: [EVENT], dates: fr });
    expect(r.args).toEqual({ title: "dinner with Ana", date: "2026-10-23", start: "09:00" });
    expect(r.parts.map((p) => p.text)).toContain("ven 23 oct 09:00");
  });

  it("suggests dates at the caret", () => {
    const r = readInlineLine({ line: "!event dinner /ve", commands: [EVENT], dates: fr });
    expect(r.suggestions[0]).toMatchObject({ kind: "date", insert: "/vendredi", label: "vendredi · ven 23 oct" });
  });
});
