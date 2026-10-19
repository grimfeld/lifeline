import { describe, expect, it } from "vitest";
import type { ImportMapping, Transaction } from "./types";
import { applyMapping, flagDuplicates, flagFuture, parseCsv, parseDate } from "./csv";

const mapping: ImportMapping = {
  dateCol: 0,
  amountCol: 1,
  payeeCol: 2,
  noteCol: null,
  idCol: 3,
  dateFormat: "DMY",
  decimal: "comma",
  invert: false,
  skipHeader: true,
};

describe("parseCsv", () => {
  it("handles quotes, escaped quotes and auto-detects the delimiter", () => {
    expect(parseCsv('a;b;"c;d"\n1;"say ""hi""";2')).toEqual([
      ["a", "b", "c;d"],
      ["1", 'say "hi"', "2"],
    ]);
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("drops blank lines", () => {
    expect(parseCsv("a,b\n\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseDate", () => {
  it("reads each format and rejects nonsense", () => {
    expect(parseDate("31-01-2026", "DMY")).toBe("2026-01-31");
    expect(parseDate("2026/01/31", "YMD")).toBe("2026-01-31");
    expect(parseDate("01/31/2026", "MDY")).toBe("2026-01-31");
    expect(parseDate("not a date", "DMY")).toBeNull();
    expect(parseDate("99-99-2026", "DMY")).toBeNull();
  });
});

describe("applyMapping", () => {
  it("reads rows, flags unreadable ones, inverts when asked", () => {
    const rows = parseCsv('Date;Amount;Payee;Id\n10-03-2026;-12,50;"Albert Heijn";tx9\nbroken;x;;\n');
    const out = applyMapping(rows, { ...mapping });
    expect(out[0]).toMatchObject({ date: "2026-03-10", amount: -1250, payee: "Albert Heijn", importId: "tx9", invalid: false });
    expect(out[1].invalid).toBe(true);
    const inverted = applyMapping(rows, { ...mapping, invert: true });
    expect(inverted[0].amount).toBe(1250);
  });
});

describe("flagFuture", () => {
  it("marks rows dated after today invalid, leaving today and the past alone", () => {
    const rows = applyMapping([["date", "amount", "payee", "id"], ["03/10/2026", "-5,00", "Cafe", ""], ["04/10/2026", "-6,00", "Cafe", ""], ["bad", "-1,00", "X", ""]], mapping);
    const flagged = flagFuture(rows, "2026-10-03");
    expect(flagged.map((r) => [r.invalid, !!r.future])).toEqual([
      [false, false],
      [true, true],
      [true, false],
    ]);
  });
});

describe("flagDuplicates", () => {
  const existing = [
    { id: "t1", kind: "expense", accountId: "a", date: "2026-03-10", amount: 1250, importId: "" },
    { id: "t2", kind: "expense", accountId: "a", date: "2026-03-11", amount: 999, importId: "bank-7" },
  ] as Transaction[];

  it("importId match is certain, fingerprint is probable, others pass", () => {
    const rows = applyMapping(parseCsv("h;h;h;h\n10-03-2026;-12,50;X;\n11-03-2026;-1,00;Y;bank-7\n12-03-2026;-5,00;Z;"), mapping);
    const flagged = flagDuplicates(rows, existing, "a");
    expect(flagged[0].duplicateOf).toBe("t1"); // same account+date+amount+kind
    expect(flagged[1].duplicateOf).toBe("t2"); // bank row id
    expect(flagged[2].duplicateOf).toBeNull();
  });

  it("fingerprints never cross accounts", () => {
    const rows = applyMapping(parseCsv("h;h;h;h\n10-03-2026;-12,50;X;"), mapping);
    expect(flagDuplicates(rows, existing, "b")[0].duplicateOf).toBeNull();
  });
});
