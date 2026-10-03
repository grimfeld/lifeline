/**
 * The canon (ADR 0032): the 66 books, their chapter counts and the
 * abbreviations people write — what the App needs to read a reference.
 * Verse counts are deliberately absent: a cross-chapter range resolves to
 * its Chapters, never to verses it cannot count.
 */
export interface CanonBook {
  /** Canonical name — the Book Document's title. */
  name: string;
  /** Lower-case forms that resolve to it, besides the name (no dots, single spaces). */
  abbr: string[];
  chapters: number;
  testament: "OT" | "NT";
}

const OT: [string, string[], number][] = [
  ["Genesis", ["gen", "ge", "gn"], 50],
  ["Exodus", ["exod", "ex", "exo"], 40],
  ["Leviticus", ["lev", "le", "lv"], 27],
  ["Numbers", ["num", "nu", "nm", "nb"], 36],
  ["Deuteronomy", ["deut", "dt", "de"], 34],
  ["Joshua", ["josh", "jos", "jsh"], 24],
  ["Judges", ["judg", "jdg", "jg", "jdgs"], 21],
  ["Ruth", ["rth", "ru"], 4],
  ["1 Samuel", ["1 sam", "1sam", "1 sa", "1sa", "i sam", "1st samuel", "first samuel"], 31],
  ["2 Samuel", ["2 sam", "2sam", "2 sa", "2sa", "ii sam", "2nd samuel", "second samuel"], 24],
  ["1 Kings", ["1 kgs", "1kgs", "1 ki", "1ki", "i kings", "1st kings", "first kings"], 22],
  ["2 Kings", ["2 kgs", "2kgs", "2 ki", "2ki", "ii kings", "2nd kings", "second kings"], 25],
  ["1 Chronicles", ["1 chr", "1chr", "1 ch", "1ch", "i chronicles", "1st chronicles", "first chronicles"], 29],
  ["2 Chronicles", ["2 chr", "2chr", "2 ch", "2ch", "ii chronicles", "2nd chronicles", "second chronicles"], 36],
  ["Ezra", ["ezr"], 10],
  ["Nehemiah", ["neh", "ne"], 13],
  ["Esther", ["esth", "est", "es"], 10],
  ["Job", ["jb"], 42],
  ["Psalms", ["psalm", "ps", "psa", "pss", "psm"], 150],
  ["Proverbs", ["prov", "pr", "prv", "pro"], 31],
  ["Ecclesiastes", ["eccl", "ecc", "ec", "qoh", "qoheleth"], 12],
  ["Song of Songs", ["song of solomon", "song", "sos", "so", "canticles", "cant"], 8],
  ["Isaiah", ["isa", "is"], 66],
  ["Jeremiah", ["jer", "je", "jr"], 52],
  ["Lamentations", ["lam", "la"], 5],
  ["Ezekiel", ["ezek", "eze", "ezk"], 48],
  ["Daniel", ["dan", "da", "dn"], 12],
  ["Hosea", ["hos", "ho"], 14],
  ["Joel", ["jl"], 3],
  ["Amos", ["am"], 9],
  ["Obadiah", ["obad", "ob"], 1],
  ["Jonah", ["jon", "jnh"], 4],
  ["Micah", ["mic", "mc"], 7],
  ["Nahum", ["nah", "na"], 3],
  ["Habakkuk", ["hab", "hb"], 3],
  ["Zephaniah", ["zeph", "zep", "zp"], 3],
  ["Haggai", ["hag", "hg"], 2],
  ["Zechariah", ["zech", "zec", "zc"], 14],
  ["Malachi", ["mal", "ml"], 4],
];
const NT: [string, string[], number][] = [
  ["Matthew", ["matt", "mt", "mat"], 28],
  ["Mark", ["mk", "mr", "mrk"], 16],
  ["Luke", ["lk", "luk"], 24],
  ["John", ["jn", "jhn", "joh"], 21],
  ["Acts", ["ac", "act"], 28],
  ["Romans", ["rom", "ro", "rm"], 16],
  ["1 Corinthians", ["1 cor", "1cor", "1 co", "1co", "i cor", "i corinthians", "1st corinthians", "first corinthians"], 16],
  ["2 Corinthians", ["2 cor", "2cor", "2 co", "2co", "ii cor", "ii corinthians", "2nd corinthians", "second corinthians"], 13],
  ["Galatians", ["gal", "ga"], 6],
  ["Ephesians", ["eph", "ephes"], 6],
  ["Philippians", ["phil", "php", "pp"], 4],
  ["Colossians", ["col", "co"], 4],
  ["1 Thessalonians", ["1 thess", "1thess", "1 th", "1th", "1 thes", "i thessalonians", "1st thessalonians", "first thessalonians"], 5],
  ["2 Thessalonians", ["2 thess", "2thess", "2 th", "2th", "2 thes", "ii thessalonians", "2nd thessalonians", "second thessalonians"], 3],
  ["1 Timothy", ["1 tim", "1tim", "1 ti", "1ti", "i timothy", "1st timothy", "first timothy"], 6],
  ["2 Timothy", ["2 tim", "2tim", "2 ti", "2ti", "ii timothy", "2nd timothy", "second timothy"], 4],
  ["Titus", ["tit", "ti"], 3],
  ["Philemon", ["phlm", "phm", "pm"], 1],
  ["Hebrews", ["heb"], 13],
  ["James", ["jas", "jm"], 5],
  ["1 Peter", ["1 pet", "1pet", "1 pe", "1pe", "1 pt", "i peter", "1st peter", "first peter"], 5],
  ["2 Peter", ["2 pet", "2pet", "2 pe", "2pe", "2 pt", "ii peter", "2nd peter", "second peter"], 3],
  ["1 John", ["1 jn", "1jn", "1 jo", "1jo", "1 joh", "i john", "1st john", "first john"], 5],
  ["2 John", ["2 jn", "2jn", "2 jo", "2jo", "2 joh", "ii john", "2nd john", "second john"], 1],
  ["3 John", ["3 jn", "3jn", "3 jo", "3jo", "3 joh", "iii john", "3rd john", "third john"], 1],
  ["Jude", ["jud", "jd"], 1],
  ["Revelation", ["rev", "re", "rv", "revelations", "apocalypse"], 22],
];

export const CANON: CanonBook[] = [
  ...OT.map(([name, abbr, chapters]): CanonBook => ({ name, abbr, chapters, testament: "OT" })),
  ...NT.map(([name, abbr, chapters]): CanonBook => ({ name, abbr, chapters, testament: "NT" })),
];

/**
 * No chapter has more verses than this (Psalm 119). Verse counts per chapter
 * are not carried, but a verse or range end beyond it is not a reference.
 */
export const MAX_VERSE = 176;

export const BOOK_ORDER = new Map(CANON.map((b, i) => [b.name, i]));

function key(s: string): string {
  return s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
}

const BY_KEY = new Map<string, CanonBook>();
for (const b of CANON) {
  BY_KEY.set(key(b.name), b);
  for (const a of b.abbr) BY_KEY.set(key(a), b);
}

/** The book a name or abbreviation means ("Jn", "1 Cor", "song of solomon"), or undefined. */
export function bookByName(name: string): CanonBook | undefined {
  return BY_KEY.get(key(name));
}

/**
 * Forms that are also everyday words (English, French): "is", "de", "am",
 * "so", "job". Together with any form of one or two letters they are read in
 * prose only when written as a reference would be — see `scanRefs`.
 */
export const WORD_FORMS = new Set(["is", "de", "am", "so", "ex", "la", "le", "ne", "es", "je", "da", "ho", "na", "re", "ac", "act", "pro", "cant", "job", "mark", "song", "acts", "numbers", "judges"]);

/** Every written form, longest first — for the scanner's alternation. */
export const BOOK_FORMS: string[] = [...BY_KEY.keys()].sort((a, b) => b.length - a.length);
