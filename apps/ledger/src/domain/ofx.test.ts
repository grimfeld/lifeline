import { describe, expect, it } from "vitest";
import { isOfx, parseOfx, parseOfxDate } from "./ofx";

const SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>EUR
<BANKTRANLIST>
<DTSTART>20260301
<DTEND>20260331
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260310120000[+1:CET]
<TRNAMT>-12.50
<FITID>2026031001
<NAME>Albert Heijn
<MEMO>Card payment
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260325
<TRNAMT>3000.00
<FITID>2026032502
<NAME>Employer BV
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260326
<TRNAMT>-8.00
<FITID>2026032603
<MEMO>Coffee &amp; cake
</STMTTRN>
</BANKTRANLIST>
<LEDGERBAL>
<BALAMT>1234.56
<DTASOF>20260331
</LEDGERBAL>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

const XML = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260310</DTPOSTED><TRNAMT>-12.50</TRNAMT><FITID>x1</FITID><NAME>Shop</NAME></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

describe("isOfx", () => {
  it("spots both flavours and rejects CSV", () => {
    expect(isOfx(SGML)).toBe(true);
    expect(isOfx(XML)).toBe(true);
    expect(isOfx("Date;Amount;Payee\n10-03-2026;-12,50;X")).toBe(false);
  });
});

describe("parseOfxDate", () => {
  it("reads bare and timestamped forms, rejects nonsense", () => {
    expect(parseOfxDate("20260310")).toBe("2026-03-10");
    expect(parseOfxDate("20260310120000[+1:CET]")).toBe("2026-03-10");
    expect(parseOfxDate("2026-03-10")).toBeNull();
    expect(parseOfxDate("20261510")).toBeNull();
  });
});

describe("parseOfx", () => {
  it("reads SGML: every STMTTRN, FITID as importId, signed cents", () => {
    const rows = parseOfx(SGML);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ date: "2026-03-10", amount: -1250, payee: "Albert Heijn", note: "Card payment", importId: "2026031001", invalid: false });
    expect(rows[1]).toMatchObject({ date: "2026-03-25", amount: 300000, payee: "Employer BV", importId: "2026032502" });
  });

  it("falls back to MEMO as payee and decodes entities", () => {
    expect(parseOfx(SGML)[2]).toMatchObject({ payee: "Coffee & cake", note: "", amount: -800 });
  });

  it("never reads the ledger balance as a transaction", () => {
    expect(parseOfx(SGML).some((r) => r.amount === 123456)).toBe(false);
  });

  it("reads XML with closed tags", () => {
    expect(parseOfx(XML)[0]).toMatchObject({ date: "2026-03-10", amount: -1250, payee: "Shop", importId: "x1", invalid: false });
  });
});
